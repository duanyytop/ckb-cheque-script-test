const CKB = require('@nervosnetwork/ckb-sdk-core').default
const { scriptToHash, rawTransactionToHash } = require('@nervosnetwork/ckb-sdk-utils')
const {
  secp256k1LockScript,
  secp256k1Dep,
  getCells,
  collectInputs,
  senderLockInfo,
  chequeLockInfo,
  collectInputsWithoutFee,
} = require('./helper')
const { ChequeDep } = require('../utils/const')
const { CKB_NODE_RPC } = require('../utils/config')

const ckb = new CKB(CKB_NODE_RPC)
const FEE = BigInt(1000)
const CHEQUE_CELL_CAPACITY = BigInt(200) * BigInt(100000000)
const CHEQUE_SINCE = '0xa000000000000006'

const generateWithdrawOutputs = async (inputCapacity, chequeInputCapacity) => {
  const { senderLockScript } = await senderLockInfo()
  let outputs = [
    {
      capacity: `0x${(inputCapacity + chequeInputCapacity - FEE).toString(16)}`,
      lock: senderLockScript,
    },
  ]
  return outputs
}

const generateWithdrawSingleOutput = async inputCapacity => {
  const { senderLockScript } = await senderLockInfo()
  let outputs = [
    {
      capacity: `0x${(inputCapacity - FEE).toString(16)}`,
      lock: senderLockScript,
    },
  ]
  return outputs
}

const withdrawChequeWithSignature = async () => {
  const { senderPrivateKey } = await senderLockInfo()
  const chequeLockScript = await chequeLockInfo()
  const chequeLiveCells = await getCells(chequeLockScript)
  const { inputs: chequeInputs, capacity: chequeCapacity } = collectInputsWithoutFee(chequeLiveCells, CHEQUE_CELL_CAPACITY, '0x0')
  const outputs = await generateWithdrawSingleOutput(chequeCapacity)
  const cellDeps = [ChequeDep]
  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs: [...chequeInputs],
    outputs,
    outputsData: ['0x'],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const signedTx = ckb.signTransaction(senderPrivateKey)(rawTx)
  const txHash = await ckb.rpc.sendTransaction(signedTx)
  console.info(`Claiming cheque cell with signature tx has been sent with tx hash ${txHash}`)
  return txHash
}

const withdrawChequeCellWithInputs = async () => {
  const { senderLockArgs, senderPrivateKey, senderLockScript } = await senderLockInfo()
  const chequeLockScript = await chequeLockInfo(true)

  const liveCells = await getCells(await secp256k1LockScript(senderLockArgs))
  const { inputs, capacity } = collectInputs(liveCells, CHEQUE_CELL_CAPACITY, '0x0')

  const chequeLiveCells = await getCells(chequeLockScript)
  const { inputs: chequeInputs, capacity: chequeCapacity } = collectInputsWithoutFee(chequeLiveCells, CHEQUE_CELL_CAPACITY, '0x0')

  const outputs = await generateWithdrawOutputs(capacity, chequeCapacity)
  const cellDeps = [await secp256k1Dep(), ChequeDep]
  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs: [...inputs, ...chequeInputs],
    outputs,
    outputsData: ['0x'],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const keys = new Map()
  keys.set(scriptToHash(senderLockScript), senderPrivateKey)
  keys.set(scriptToHash(chequeLockScript), null)
  const signedWitnesses = ckb.signWitnesses(keys)({
    transactionHash: rawTransactionToHash(rawTx),
    witnesses: rawTx.witnesses,
    inputCells: rawTx.inputs.map((input, index) => {
      return {
        outPoint: input.previousOutput,
        lock: index === 0 ? senderLockScript : chequeLockScript,
      }
    }),
    skipMissingKeys: true,
  })
  const signedTx = { ...rawTx, witnesses: signedWitnesses }
  const txHash = await ckb.rpc.sendTransaction(signedTx)
  console.info(`Withdraw cheque cell with inputs tx has been sent with tx hash ${txHash}`)
  return txHash
}

module.exports = {
  withdrawChequeCellWithInputs,
  withdrawChequeWithSignature,
}
