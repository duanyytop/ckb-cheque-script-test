const { createChequeCell, claimChequeWithSignature, claimChequeWithInputs } = require('./rpc/claim')
const { withdrawChequeCellWithInputs, withdrawChequeWithSignature } = require('./rpc/withdraw')

const doClaimingCellWithSignature = async () => {
  await createChequeCell()
  setTimeout(async () => {
    await claimChequeWithSignature()
  }, 20000)
}

const doClaimingCellWithInputs = async () => {
  await createChequeCell()
  setTimeout(async () => {
    await claimChequeWithInputs()
  }, 20000)
}

const doWithdrawingCellWithSignature = async () => {
  await createChequeCell()
  setTimeout(async () => {
    await withdrawChequeWithSignature()
  }, 20000)
}

const doWithdrawingCellWithInputs = async () => {
  // await createChequeCell()
  // setTimeout(async () => {
  await withdrawChequeCellWithInputs()
  // }, 20000)
}

// doClaimingCellWithSignature()
// doClaimingCellWithInputs()
// doWithdrawingCellWithSignature()
doWithdrawingCellWithInputs()
