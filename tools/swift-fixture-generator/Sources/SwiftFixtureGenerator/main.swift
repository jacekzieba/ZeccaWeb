import CryptoKit
import Foundation
import InvestorCore
import InvestorDomain

enum HarnessError: Error, CustomStringConvertible {
    case missingPath
    case unsupportedInput

    var description: String {
        switch self {
        case .missingPath:
            return "Missing JSON path. Usage: swift run SwiftFixtureGenerator decode-payloads <payloads.json>"
        case .unsupportedInput:
            return "Input must be a JSON array, or an object with plaintextPayloads, payloads, or records[].payload."
        }
    }
}

let arguments = Array(CommandLine.arguments.dropFirst())

if arguments.first == "decode-payloads" {
    do {
        guard arguments.count >= 2 else { throw HarnessError.missingPath }
        try decodePayloads(at: URL(fileURLWithPath: arguments[1]))
    } catch {
        FileHandle.standardError.write(Data("decode-payloads failed: \(error)\n".utf8))
        exit(1)
    }
    exit(0)
}

let fixedKey = SymmetricKey(data: Data((0..<32).map(UInt8.init)))
let fixedNonceData = Data((16..<28).map(UInt8.init))
let fixedBackupPassphrase = "swift web backup fixture"
let fixedBackupSalt = Data((120..<136).map(UInt8.init))
let fixedBackupNonceData = Data((136..<148).map(UInt8.init))
let portfolioID = UUID(uuidString: "1A3E2E4F-C9F1-45AB-A67D-A9EF0351B5A7")!
let instrumentID = UUID(uuidString: "68295849-B3D6-4E95-95C8-F12C23F7B7B2")!
let transactionID = UUID(uuidString: "B8805A78-B5A5-4FE7-A83F-716117184D25")!
let userID = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
let timestamp = Date(timeIntervalSince1970: 1_714_694_400)

let transaction = Transaction(
    id: transactionID,
    date: timestamp,
    portfolioID: portfolioID,
    instrumentID: instrumentID,
    type: .buy,
    quantity: 3,
    price: 400,
    grossAmount: 1_200,
    currency: "PLN",
    fees: 5,
    taxes: 0,
    fxRateToBase: nil,
    notes: "Swift fixture",
    createdAt: timestamp,
    updatedAt: timestamp
)

let plaintextData = try JSONEncoder().encode(
    SyncPayloadEnvelope.transaction(TransactionPayload(transaction: transaction))
)
let plaintext = try JSONSerialization.jsonObject(with: plaintextData)
let nonce = try AES.GCM.Nonce(data: fixedNonceData)
let sealedBox = try AES.GCM.seal(plaintextData, using: fixedKey, nonce: nonce)
let encryptedPayloadBase64 = (sealedBox.ciphertext + sealedBox.tag).base64EncodedString()
let nonceBase64 = fixedNonceData.base64EncodedString()
let keyBase64 = fixedKey.withUnsafeBytes { Data($0).base64EncodedString() }
let keyBackupService = KeyBackupService()
let fixedBackupDerivedKey = try keyBackupService.deriveKey(
    passphrase: fixedBackupPassphrase,
    salt: fixedBackupSalt,
    iterations: 1_000
)
let fixedBackupNonce = try AES.GCM.Nonce(data: fixedBackupNonceData)
let fixedRawUserDataKey = fixedKey.withUnsafeBytes { Data($0) }
let fixedBackupSealedBox = try AES.GCM.seal(
    fixedRawUserDataKey,
    using: fixedBackupDerivedKey,
    nonce: fixedBackupNonce
)
let keyBackup: [String: Any] = [
    "passphrase": fixedBackupPassphrase,
    "encrypted_user_data_key": (fixedBackupSealedBox.ciphertext + fixedBackupSealedBox.tag).base64EncodedString(),
    "salt": fixedBackupSalt.base64EncodedString(),
    "nonce": fixedBackupNonceData.base64EncodedString(),
    "kdf": "pbkdf2-sha256",
    "kdf_iterations": 1_000
]

let record: [String: Any] = [
    "id": transactionID.uuidString.lowercased(),
    "user_id": userID.uuidString.lowercased(),
    "record_type": "transaction",
    "encrypted_payload": encryptedPayloadBase64,
    "nonce": nonceBase64,
    "payload_version": 1,
    "schema_version": 1,
    "device_id": "swift-fixture",
    "created_at": "2026-05-15T00:00:00.000Z",
    "updated_at": "2026-05-15T00:00:00.000Z",
    "deleted_at": NSNull()
]

let fixture: [String: Any] = [
    "description": "Swift CryptoKit AES-GCM transaction fixture using InvestorCore SyncPayloadEnvelope",
    "keyBase64": keyBase64,
    "nonceBase64": nonceBase64,
    "encryptedPayloadBase64": encryptedPayloadBase64,
    "keyBackup": keyBackup,
    "plaintext": plaintext,
    "record": record
]

let output = try JSONSerialization.data(
    withJSONObject: fixture,
    options: [.prettyPrinted, .sortedKeys]
)
FileHandle.standardOutput.write(output)
FileHandle.standardOutput.write(Data("\n".utf8))

func decodePayloads(at url: URL) throws {
    let input = try Data(contentsOf: url)
    let json = try JSONSerialization.jsonObject(with: input)
    let payloadObjects = try extractPayloadObjects(from: json)
    let decoder = JSONDecoder()
    var counts: [String: Int] = [:]
    var failures: [[String: String]] = []

    for (index, payloadObject) in payloadObjects.enumerated() {
        let payloadData = try JSONSerialization.data(withJSONObject: payloadObject, options: [.sortedKeys])

        do {
            let envelope = try decoder.decode(SyncPayloadEnvelope.self, from: payloadData)
            counts[envelope.recordType, default: 0] += 1
            try validateDomainConversion(envelope)
        } catch {
            failures.append([
                "index": String(index),
                "error": String(describing: error)
            ])
        }
    }

    let result: [String: Any] = [
        "ok": failures.isEmpty,
        "decoded": payloadObjects.count - failures.count,
        "failed": failures.count,
        "byType": counts,
        "failures": failures
    ]
    let output = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(output)
    FileHandle.standardOutput.write(Data("\n".utf8))

    if !failures.isEmpty {
        exit(1)
    }
}

func extractPayloadObjects(from json: Any) throws -> [[String: Any]] {
    if let array = json as? [[String: Any]] {
        return array
    }

    guard let object = json as? [String: Any] else {
        throw HarnessError.unsupportedInput
    }

    if let payloads = object["plaintextPayloads"] as? [[String: Any]] {
        return payloads
    }

    if let payloads = object["payloads"] as? [[String: Any]] {
        return payloads
    }

    if let records = object["records"] as? [[String: Any]] {
        let payloads = records.compactMap { $0["payload"] as? [String: Any] }
        if payloads.count == records.count {
            return payloads
        }
    }

    throw HarnessError.unsupportedInput
}

func validateDomainConversion(_ envelope: SyncPayloadEnvelope) throws {
    switch envelope {
    case .account(let payload):
        _ = payload.toPortfolio()
    case .asset(let payload):
        _ = payload.toInstrument()
    case .transaction(let payload):
        _ = payload.toTransaction()
    case .manualValuation(let payload):
        _ = payload.toManualValuation()
    case .income(let payload):
        switch payload.entryKind {
        case .earning:
            guard payload.toEarning() != nil else {
                throw DecodingError.dataCorrupted(
                    .init(codingPath: [], debugDescription: "Income earning payload did not convert to Earning")
                )
            }
        case .burden:
            guard payload.toBurden() != nil else {
                throw DecodingError.dataCorrupted(
                    .init(codingPath: [], debugDescription: "Income burden payload did not convert to EarningBurden")
                )
            }
        }
    case .settings(let payload):
        _ = payload.toSettings()
    }
}
