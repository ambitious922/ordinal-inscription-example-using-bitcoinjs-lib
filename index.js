const {
  createTextInscription,
  createCommitTxData,
  createRevealTx,
} = require('./src/ordinals-bitcoinjs')

const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1')
const { ECPairFactory } = require('ecpair')
const axios = require('axios')

const unisatApiUrl = 'https://wallet-api-fractal-testnet.unisat.io'

bitcoin.initEccLib(ecc)

const ECPair = ECPairFactory(ecc)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const checkUtxosOnAddress = async (address, satAmount) => {
  try {
    const res = await axios.get(`${unisatApiUrl}/v5/address/btc-utxo`, {
      params: {
        address,
      },
    })
    const btcUtxos = res.data.data
    if (btcUtxos[0]?.satoshis >= satAmount) {
      return btcUtxos[0]
    }
    return undefined
  } catch (err) {
    console.log(err)
    return undefined
  }
}

const waitUntilUtxo = async (address, requiredAmount) => {
  while (true) {
    console.log('waiting utxo')
    try {
      const res = await checkUtxosOnAddress(address, requiredAmount)
      if (res) {
        return {
          txId: res.txid,
          sendUtxoIndex: res.vout,
          sendAmount: requiredAmount,
        }
      }
      await sleep(5000)
    } catch (error) {
      console.log(error)
      return false
    }
  }
}

const pushTx = async (txHex) => {
  let res = {}
  try {
    res = await axios.post(`https://mempool.fractalbitcoin.io/api/tx`, txHex, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
    console.log(res.data)
    return res.data
  } catch (err) {
    console.log(err.response.data)
    res.error = err.response.data
    return res
  }
}

const inscribe = async () => {
  const keypair = ECPair.makeRandom()
  try {
    const inscription = createTextInscription({ text: 'Hello!!' })
    const commitTxData = createCommitTxData({
      publicKey: keypair.publicKey,
      inscription,
    })

    const toAddress = 'bc1paecm08dk47z8d63krn8mne5e2ga8jhk557n4f562zfjs58yn780scgdmte'

    const padding = 549
    const txSize = 600 + Math.floor(inscription.content.length / 4)
    const feeRate = 2
    const minersFee = txSize * feeRate

    const requiredAmount = 550 + minersFee + padding

    // expect(requiredAmount).toEqual(2301)

    console.log({ requiredAmount }, { address: commitTxData.revealAddress })

    const commitTxResult = await waitUntilUtxo(commitTxData.revealAddress, requiredAmount)
    // const commitTxResult = {
    //   txId: 'd2e8358a8f6257ed6fc5eabe4e85951b702918a7a5d5b79a45e535e1d5d65fb2',
    //   sendUtxoIndex: 1,
    //   sendAmount: requiredAmount,
    // }

    const revelRawTx = await createRevealTx({
      commitTxData,
      commitTxResult,
      toAddress,
      privateKey: keypair.privateKey,
      amount: padding,
    })
    console.log(revelRawTx)
    const res = await pushTx(revelRawTx.rawTx)
    console.log({ res })
  } catch (error) {
    console.log(error)
  }
}

inscribe()
