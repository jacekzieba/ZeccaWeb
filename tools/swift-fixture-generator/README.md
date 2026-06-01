# Swift Fixture Generator

Generates a deterministic CryptoKit fixture from the native Investor package without modifying the native repository.

```bash
swift run --package-path tools/swift-fixture-generator SwiftFixtureGenerator
```

The output is committed as:

```text
tests/fixtures/crypto/aes-gcm-swift.transaction.json
```

## Decode web/native payloads without launching macOS UI

Use this while the macOS app UI is being refactored. It validates that the
native `SyncPayloadEnvelope` can decode payload JSON and convert it to native
domain models:

```bash
swift run --package-path tools/swift-fixture-generator SwiftFixtureGenerator decode-payloads tests/fixtures/macos-refactor/sync-fixture.json
```

Accepted input shapes:

- an array of payload objects,
- an object with `plaintextPayloads`,
- an object with `payloads`,
- an object with `records[].payload`.
