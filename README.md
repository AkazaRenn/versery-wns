# WNS Raw Notification Proxy

This Next.js API route relays Mastodon Web Push messages to a Windows Push
Notification Services (WNS) channel URI as raw notifications. The encrypted
body is never decrypted here; the client decrypts it with the keys it
registered for the account.

## Configuration

Set `ACCESS_TOKEN` to a valid WNS OAuth access token in the environment where
the app runs. In Vercel, add it under **Project Settings > Environment
Variables**. Do not expose it with a `NEXT_PUBLIC_` prefix.

## Request
Use `https://your-deployment/{account}/{channelUri}` as the Web Push
subscription endpoint, where:

- `channelUri` is the complete WNS channel URI encoded as base64url.
- `account` is an identifier the client uses to pick the decryption keys
  (for example, a per-account GUID).

The request body must be encrypted with `Content-Encoding: aes128gcm`
(RFC 8291). In Mastodon, create the subscription with `"standard": true`.

The relay sends this JSON to WNS with `Content-Type: application/octet-stream`
and `X-WNS-Type: wns/raw`:

```json
{ "i": "<account>", "m": "<base64url of the request body>" }
```

For example:

```bash
curl -X POST "https://your-deployment.vercel.app/$ACCOUNT/$CHANNEL_URI_B64URL" \
	-H 'Content-Encoding: aes128gcm' \
	--data-binary @encrypted-body.bin
```

The route returns WNS's HTTP status with an empty body, so Mastodon removes the
subscription when WNS reports the channel as gone. It returns `400` for a
missing account or an invalid channel URI, `415` if the body is not
`aes128gcm`, `500` if `ACCESS_TOKEN` is missing, and `502` `400` for an invalid channel URI, `500` if `ACCESS_TOKEN` is missing, and `502`
if forwarding fails.

## Development

The test script uses Node's built-in TypeScript stripping and requires Node.js
22.6 or newer.

```bash
npm install
npm run dev
npm test
```

The production build can be checked with `npm run build`.

## Implementation Reference

The work takes a reference from [feditext-apns](https://github.com/feditext/feditext-apns).

## License

This project is licensed under the GNU Affero General Public License, version 3
only. See [LICENSE](LICENSE) for the full text.
