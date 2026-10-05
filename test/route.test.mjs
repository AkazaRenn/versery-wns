import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from '../app/[...route]/route.ts'

const channelUri = 'https://cloud.notify.windows.com/?token=example'
const encodedChannelUri = Buffer.from(channelUri).toString('base64url')
const account = '0F8FAD5B-D9CB-469F-A165-70867728950E'
const body = new Uint8Array([0, 1, 2, 250, 251, 255])

function mockWns(t, upstream = () => new Response('accepted', { status: 200 })) {
  const previousAccessToken = process.env.ACCESS_TOKEN
  const originalFetch = globalThis.fetch
  const calls = []

  process.env.ACCESS_TOKEN = 'test-access-token'
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return upstream()
  }

  t.after(() => {
    if (previousAccessToken === undefined) {
      delete process.env.ACCESS_TOKEN
    } else {
      process.env.ACCESS_TOKEN = previousAccessToken
    }
    globalThis.fetch = originalFetch
  })

  return calls
}

function post(route, contentEncoding = 'aes128gcm') {
  return POST(
    new Request(`https://proxy.example/${route.join('/')}`, {
      method: 'POST',
      headers: contentEncoding ? { 'Content-Encoding': contentEncoding } : {},
      body,
    }),
    { params: Promise.resolve({ route }) }
  )
}

test('wraps the body and account into a raw WNS notification', async (t) => {
  const calls = mockWns(t)

  const response = await post([account, encodedChannelUri])

  assert.equal(calls.length, 1)
  const { url, options } = calls[0]
  assert.equal(url.href, channelUri)
  assert.equal(options.method, 'POST')
  assert.equal(options.headers.Authorization, 'Bearer test-access-token')
  assert.equal(options.headers['Content-Type'], 'application/octet-stream')
  assert.equal(options.headers['X-WNS-Type'], 'wns/raw')

  const forwarded = JSON.parse(options.body)
  assert.equal(forwarded.i, account)
  assert.deepEqual(new Uint8Array(Buffer.from(forwarded.m, 'base64url')), body)

  assert.equal(response.status, 200)
  assert.equal(await response.text(), '')
})

test('returns only the WNS status code', async (t) => {
  mockWns(t, () => new Response('gone', { status: 410, headers: { 'x-wns-status': 'dropped' } }))

  const response = await post([account, encodedChannelUri])

  assert.equal(response.status, 410)
  assert.equal(response.headers.get('x-wns-status'), null)
  assert.equal(await response.text(), '')
})

test('rejects a route without an account', async (t) => {
  const calls = mockWns(t)

  const response = await post([account])

  assert.equal(response.status, 400)
  assert.equal(calls.length, 0)
})

test('rejects bodies not encoded with aes128gcm', async (t) => {
  const calls = mockWns(t)

  for (const encoding of ['aesgcm', null]) {
    const response = await post([account, encodedChannelUri], encoding)
    assert.equal(response.status, 415)
  }
  assert.equal(calls.length, 0)
})

test('rejects channel URIs outside WNS', async (t) => {
  const calls = mockWns(t)
  const evil = Buffer.from('https://example.com/?token=x').toString('base64url')

  const response = await post([account, evil])

  assert.equal(response.status, 400)
  assert.equal(calls.length, 0)
})