import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useDeepCompareEffect from "use-deep-compare-effect";
import styled from "styled-components";

import Card from "../../components/Card";
import SubTitle from "../../components/SubTitle";
import Input from "./Input";
import CommentList from "./CommentList";
import { unique } from "../../utils/index";
import {
  fetchComments,
  commentsSelector
} from "../../store/reducers/commentSlice";

import { useLocation } from "react-router-dom";

const Header = styled(SubTitle)`
  margin-bottom: 16px;
`;

const Wrapper = styled(Card)`
  padding: 0;
`;

const Comment = ({ type, index }) => {
  const [content, setContent] = useState("");
  const dispatch = useDispatch();

  useDeepCompareEffect(() => {
    dispatch(fetchComments(type, index));
  }, [dispatch, type, index]);

  const comments = useSelector(commentsSelector);
  const authors = unique((comments || []).map((item) => item.author.username));

  const { hash } = useLocation();
  const refCommentId = hash && hash.slice(1);

  const onReplyButton = (reply) => {
    setContent(reply);
  }

  return (
    <div>
      <Header>Comment</Header>
      <Wrapper>
        <CommentList
          type={type}
          index={index}
          comments={comments}
          refCommentId={refCommentId}
          onReplyButton={onReplyButton}
        />
        <Input type={type} index={index} authors={authors} content={content} setContent={setContent} />
      </Wrapper>
    </div>
  );
};

export default Comment;
