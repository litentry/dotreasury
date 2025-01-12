const { getBurntCollection } = require("../../mongo");
const { extractPage } = require("../../utils");

class BurntController {
  async getBurntList(ctx) {
    const { chain } = ctx.params;
    const { page, pageSize } = extractPage(ctx);
    if (pageSize === 0 || page < 0) {
      ctx.status = 400;
      return;
    }

    const burntCol = await getBurntCollection(chain);
    const burntList = await burntCol
      .find({})
      .sort({
        "indexer.blockHeight": -1,
      })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();
    const total = await burntCol.estimatedDocumentCount();

    ctx.body = {
      items: burntList,
      page,
      pageSize,
      total,
    };
  }

  async getBurntCount(ctx) {
    const { chain } = ctx.params;
    const burntCol = await getBurntCollection(chain);
    const burntCount = await burntCol.estimatedDocumentCount();
    ctx.body = burntCount;
  }
}

module.exports = new BurntController();
