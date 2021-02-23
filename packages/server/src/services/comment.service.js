const { ObjectId } = require("mongodb");
const mailService = require("./mail.service");
const {
  withTransaction,
  getCommentCollection,
  getReactionCollection,
  getUserCollection,
} = require("../mongo-admin");
const { HttpError } = require("../exc");
const { DefaultUserNotification } = require("../contants");
const { md5 } = require("../utils");

class CommentService {
  async getComments(indexer, page, pageSize) {
    const commentCol = await getCommentCollection();
    const total = await commentCol.countDocuments({ indexer });

    if (page === "last") {
      const totalPages = Math.ceil(total / pageSize);
      page = totalPages - 1;
    }

    const comments = await commentCol
      .aggregate([
        { $match: { indexer } },
        { $sort: { createdAt: 1 } },
        { $skip: page * pageSize },
        { $limit: pageSize },
        {
          $lookup: {
            from: "reaction",
            localField: "_id",
            foreignField: "commentId",
            as: "reactions",
          },
        },
      ])
      .toArray();

    if (comments.length > 0) {
      const userIds = new Set();
      comments.forEach((comment) => {
        userIds.add(comment.authorId.toString());
        comment.reactions?.forEach((reaction) => {
          userIds.add(reaction.userId.toString());
        });
      });

      const userCol = await getUserCollection();
      const users = await userCol
        .aggregate([
          {
            $match: {
              _id: {
                $in: Array.from(userIds).map(ObjectId),
              },
            },
          },
          {
            $lookup: {
              from: "address",
              let: { userId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$userId", "$$userId"],
                    },
                  },
                },
                { $unwind: "$chains" },
                {
                  $project: {
                    wildcardAddress: 1,
                    chain: "$chains.chain",
                    address: "$chains.address",
                    _id: 0,
                  },
                },
              ],
              as: "addresses",
            },
          },
          { $project: { username: 1, email: 1, addresses: 1 } },
        ])
        .toArray();

      const userMap = {};
      users.forEach((user) => {
        userMap[user._id.toString()] = user;
        const emailHash = md5(user.email.trim().toLocaleLowerCase());
        user.avatar = `https://www.gravatar.com/avatar/${emailHash}?d=https://www.dotreasury.com/imgs/avatar.png`;
        delete user.email;
        delete user._id;
      });

      comments.forEach((comment) => {
        comment.author = userMap[comment.authorId.toString()];
        delete comment.authorId;
        comment.reactions?.forEach((reaction) => {
          reaction.user = userMap[reaction.userId.toString()];
          delete reaction.userId;
        });
      });
    }

    return {
      items: comments,
      page,
      pageSize,
      total,
    };
  }

  async postComment(indexer, content, author) {
    if (!author.emailVerified) {
      throw new HttpError(
        403,
        "Cannot post because the account is not verified yet."
      );
    }

    const commentCol = await getCommentCollection();

    const now = new Date();
    const result = await commentCol.insertOne({
      indexer,
      authorId: author._id,
      content,
      createdAt: now,
      updatedAt: now,
    });

    if (!result.result.ok) {
      throw new HttpError(500, "Post comment error.");
    }

    const commentId = result.ops[0]._id;

    // Count position
    const commentPosition = await commentCol.countDocuments({
      indexer,
      _id: { $lte: commentId },
    });

    // Send notification email to mentioned users
    this.processMetions(indexer, commentId, commentPosition, content, author);

    return commentId;
  }

  async processMetions(indexer, commentId, commentPosition, content, author) {
    const metions = new Set();
    const reMetion = /\[@(\w+)\]\(https:\/\/dotreasury.com\/user\/(\w+)\)/g;
    let match;
    while ((match = reMetion.exec(content)) !== null) {
      const [, u1, u2] = match;
      if (u1 === u2) {
        metions.add(u1);
      }
    }

    if (metions.size === 0) {
      return;
    }

    const userCol = await getUserCollection();
    const users = await userCol
      .find(
        {
          username: {
            $in: Array.from(metions),
          },
        },
        {
          projection: {
            username: 1,
            email: 1,
            notification: 1,
            emailVerified: 1,
          },
        }
      )
      .toArray();

    for (const user of users) {
      if (
        user.emailVerified &&
        (user.notification?.mentioned ?? DefaultUserNotification.mentioned)
      ) {
        mailService.sendCommentMentionEmail({
          email: user.email,
          author: author.username,
          mentioned: user.username,
          content,
          indexer,
          commentId,
          commentPosition,
        });
      }
    }
  }

  async updateComment(commentId, newContent, author) {
    const commentCol = await getCommentCollection();

    const now = new Date();
    const result = await commentCol.findOneAndUpdate(
      {
        _id: ObjectId(commentId),
        authorId: author._id,
      },
      {
        $set: {
          content: newContent,
          updatedAt: now,
        },
      },
      {
        projection: {
          indexer: 1,
        },
      }
    );

    if (!result.ok) {
      throw new HttpError(500, "Update comment error.");
    }

    if (!result.value) {
      return false;
    }

    const { indexer } = result.value;

    // Count position
    const commentPosition = await commentCol.countDocuments({
      indexer,
      _id: { $lte: commentId },
    });

    // Send notification email to mentioned users
    this.processMetions(
      indexer,
      commentId,
      commentPosition,
      newContent,
      author
    );

    return true;
  }

  async deleteComment(commentId, author) {
    await withTransaction(async (session) => {
      let result;

      const commentCol = await getCommentCollection();
      result = await commentCol.deleteOne(
        {
          _id: ObjectId(commentId),
          authorId: author._id,
        },
        { session }
      );

      if (!result.result.ok) {
        throw new HttpError(500, "Delete comment error.");
      }

      if (result.result.n === 0) {
        throw new HttpError(403, "Cannot delete comment.");
      }

      const reactionCol = await getReactionCollection();
      result = await reactionCol.deleteMany(
        { commentId: ObjectId(commentId) },
        { session }
      );

      if (!result.result.ok) {
        throw new HttpError(500, "Delete comment reactions error.");
      }
    });

    return true;
  }

  async unsetCommentReaction(commentId, user) {
    const reactionCol = await getReactionCollection();

    const result = await reactionCol.deleteOne({
      commentId: ObjectId(commentId),
      userId: user._id,
    });

    if (!result.result.ok) {
      throw new HttpError(500, "Db error, clean reaction.");
    }

    if (result.result.nModified === 0) {
      return false;
    }

    return true;
  }

  async setCommentReaction(commentId, reaction, user) {
    const commentCol = await getCommentCollection();
    const existing = await commentCol.countDocuments({
      _id: ObjectId(commentId),
      authorId: { $ne: user._id },
    });
    if (existing === 0) {
      throw new HttpError(403, "Cannot set reaction.");
    }

    const reactionCol = await getReactionCollection();

    const now = new Date();
    const result = await reactionCol.updateOne(
      {
        commentId: ObjectId(commentId),
        userId: user._id,
      },
      {
        $set: {
          reaction,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    if (!result.result.ok) {
      throw new HttpError(500, "Db error, update reaction.");
    }

    return true;
  }

  async hasComment(author) {
    const commentCol = await getCommentCollection();
    const existing = await commentCol.findOne({ authorId: author._id });
    return !!existing;
  }
}

module.exports = new CommentService();
