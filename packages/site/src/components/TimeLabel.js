import React from "react";
import styled from "styled-components";
import { Image } from "semantic-ui-react";
import TimeElapsed from "./TimeElapsed";

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Label = styled.span`
  font-family: Inter;
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  line-height: 24px;
  color: rgba(29, 37, 60, 0.64);
`;

const TimeLabel = ({ value }) => {
  return (
    <Wrapper>
      <Image src={"/imgs/time.svg"} />
      <Label><TimeElapsed from={value} /></Label>
    </Wrapper>
  );
};

export default TimeLabel;