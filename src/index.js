const { createChequeCell, claimChequeWithSignature, claimChequeWithInputs } = require('./rpc/claim')
const { createWithdrawChequeCell, withdrawChequeCell } = require('./rpc/withdraw')

const doClaimingCellWithSignature = async () => {
  await createChequeCell(true)
  setTimeout(async () => {
    await claimChequeWithSignature()
  }, 20000)
}

const doClaimingCellWithInputs = async () => {
  await createChequeCell(false)
  setTimeout(async () => {
    await claimChequeWithInputs()
  }, 20000)
}

const doWithdrawingCell = async () => {
  await createWithdrawChequeCell()
  setTimeout(async () => {
    await withdrawChequeCell()
  }, 20000)
}

doClaimingCellWithSignature()
// doClaimingCellWithInputs()
// doWithdrawingCell()
