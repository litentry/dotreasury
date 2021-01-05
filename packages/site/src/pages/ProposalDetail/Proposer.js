import React from "react";
import styled from "styled-components";

import Voter from "./Voter";
import BarProgress from "../../components/BarProgress";
import TextMinor from "../../components/TextMinor";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 21px;
`

const BarProgressWrapper = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 9px;
  align-items: center;
`

const CustomText = styled(TextMinor)`
  white-space: nowrap;
`

const Proposer = ({address, agree, value, threshold, ayes }) => {
  return (
    <Wrapper>
      <Voter address={address} agree={agree} value={value} />
      <BarProgressWrapper>
        <BarProgress current={ayes} total={threshold} />
        <CustomText>{`${ayes}/${threshold}`}</CustomText>
      </BarProgressWrapper>
    </Wrapper>
  )
}

export default Proposer;
