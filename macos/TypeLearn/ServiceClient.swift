import Foundation

struct ServiceHealth: Decodable {
    let status: String
    let service: String
    let providerModes: [String]
}

struct LearningArtifact: Decodable, Identifiable {
    let id: String
    let sourceText: String
    let restoredText: String?
    let suggestion: String
    let explanation: String
    let createdAt: String
    let status: String?
}

struct CaptureRecord: Decodable, Identifiable {
    let id: String
    let sourceText: String
    let restoredText: String?
    let englishText: String
    let sourceLanguage: String
    let sourceApp: String?
    let createdAt: String
    let status: String
    let retryCount: Int
    let lastError: String?
}

struct StoryArtifact: Decodable, Identifiable {
    let id: String
    let title: String
    let story: String
    let createdAt: String
    let sourceRecordIds: [String]
}

struct ProviderSettings: Codable {
    var baseUrl: String
    var apiKey: String
    var model: String
}

private struct ArtifactListResponse: Decodable {
    let items: [LearningArtifact]
}

private struct RecordListResponse: Decodable {
    let items: [CaptureRecord]
}

private struct StoryListResponse: Decodable {
    let items: [StoryArtifact]
}

private struct ArtifactCreateRequest: Encodable {
    let sourceText: String
    let sourceApp: String?
    let settings: ProviderSettings?
}

private struct ArtifactCreateResponse: Decodable {
    let item: LearningArtifact
    let record: CaptureRecord
}

private struct StoryCreateResponse: Decodable {
    let item: StoryArtifact
}

enum ServiceConnectionState {
    case idle
    case connecting
    case connected(ServiceHealth)
    case failed(String)
}

@Observable
final class ServiceClient {
    private(set) var state: ServiceConnectionState = .idle
    private(set) var latestArtifact: LearningArtifact?
    private(set) var records: [CaptureRecord] = []
    private(set) var stories: [StoryArtifact] = []
    private(set) var settings = ProviderSettings(baseUrl: "", apiKey: "", model: "gpt-4.1-mini")
    private(set) var artifactError: String?
    private(set) var isSubmittingArtifact = false
    private(set) var isGeneratingStory = false
    private let session: URLSession
    private let baseURL: URL
    private var pollTask: Task<Void, Never>?

    init(
        session: URLSession = .shared,
        baseURL: URL = URL(string: "http://127.0.0.1:43010")!
    ) {
        self.session = session
        self.baseURL = baseURL
    }

    @MainActor
    func refreshHealth() async {
        state = .connecting

        do {
            let url = baseURL.appending(path: "health")
            let (data, response) = try await session.data(from: url)
            let httpResponse = response as? HTTPURLResponse

            guard httpResponse?.statusCode == 200 else {
                state = .failed("Service returned an unexpected status.")
                return
            }

            let health = try JSONDecoder().decode(ServiceHealth.self, from: data)
            state = .connected(health)
            try await loadArtifacts()
            try await loadRecords()
            try await loadStories()
            try await loadSettings()
            startPolling()
        } catch {
            state = .failed("Local service unavailable. Start npm run dev:service.")
            stopPolling()
        }
    }

    @MainActor
    func submitArtifact(sourceText: String, sourceApp: String? = nil) async {
        let trimmed = sourceText.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmed.isEmpty else {
            artifactError = "Enter some English text before generating a learning item."
            return
        }

        isSubmittingArtifact = true
        artifactError = nil

        defer {
            isSubmittingArtifact = false
        }

        do {
            var request = URLRequest(url: baseURL.appending(path: "artifacts"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let settingsPayload = settings.baseUrl.isEmpty ? nil : settings
            request.httpBody = try JSONEncoder().encode(
                ArtifactCreateRequest(sourceText: trimmed, sourceApp: sourceApp, settings: settingsPayload)
            )

            let (data, response) = try await session.data(for: request)
            let httpResponse = response as? HTTPURLResponse

            guard httpResponse?.statusCode == 201 else {
                artifactError = "Could not create a learning item."
                return
            }

            let payload = try JSONDecoder().decode(ArtifactCreateResponse.self, from: data)
            latestArtifact = payload.item
            records.insert(payload.record, at: 0)
            try await loadArtifacts()
            try await loadRecords()
            artifactError = nil
        } catch {
            artifactError = "Could not reach the local service."
        }
    }

    @MainActor
    func deleteRecord(id: String) async {
        var request = URLRequest(url: baseURL.appending(path: "records/") .appending(path: id))
        request.httpMethod = "DELETE"

        do {
            let (_, response) = try await session.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            guard httpResponse?.statusCode == 204 else { return }
            records.removeAll { $0.id == id }
        } catch {
            artifactError = "Could not delete that capture record."
        }
    }

    @MainActor
    func generateStory() async {
        isGeneratingStory = true
        defer { isGeneratingStory = false }

        do {
            var request = URLRequest(url: baseURL.appending(path: "stories/generate"))
            request.httpMethod = "POST"
            let (data, response) = try await session.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            guard httpResponse?.statusCode == 201 else {
                artifactError = "Could not generate today's story."
                return
            }

            let payload = try JSONDecoder().decode(StoryCreateResponse.self, from: data)
            stories.insert(payload.item, at: 0)
        } catch {
            artifactError = "Could not reach the story generator."
        }
    }

    @MainActor
    func saveSettings() async {
        do {
            var request = URLRequest(url: baseURL.appending(path: "settings"))
            request.httpMethod = "PUT"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(settings)

            let (data, response) = try await session.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            guard httpResponse?.statusCode == 200 else {
                artifactError = "Could not save provider settings."
                return
            }

            settings = try JSONDecoder().decode(ProviderSettings.self, from: data)
        } catch {
            artifactError = "Could not save provider settings."
        }
    }

    @MainActor
    func updateSettings(baseUrl: String, apiKey: String, model: String) {
        settings = ProviderSettings(baseUrl: baseUrl, apiKey: apiKey, model: model)
    }

    @MainActor
    private func loadArtifacts() async throws {
        let (data, response) = try await session.data(from: baseURL.appending(path: "artifacts"))
        let httpResponse = response as? HTTPURLResponse

        guard httpResponse?.statusCode == 200 else {
            artifactError = "Could not load previous learning items."
            return
        }

        let payload = try JSONDecoder().decode(ArtifactListResponse.self, from: data)
        latestArtifact = payload.items.first
    }

    @MainActor
    private func loadRecords() async throws {
        let (data, response) = try await session.data(from: baseURL.appending(path: "records"))
        let httpResponse = response as? HTTPURLResponse
        guard httpResponse?.statusCode == 200 else { return }
        records = try JSONDecoder().decode(RecordListResponse.self, from: data).items
    }

    @MainActor
    private func loadStories() async throws {
        let (data, response) = try await session.data(from: baseURL.appending(path: "stories"))
        let httpResponse = response as? HTTPURLResponse
        guard httpResponse?.statusCode == 200 else { return }
        stories = try JSONDecoder().decode(StoryListResponse.self, from: data).items
    }

    @MainActor
    private func loadSettings() async throws {
        let (data, response) = try await session.data(from: baseURL.appending(path: "settings"))
        let httpResponse = response as? HTTPURLResponse
        guard httpResponse?.statusCode == 200 else { return }
        settings = try JSONDecoder().decode(ProviderSettings.self, from: data)
    }

    @MainActor
    private func startPolling() {
        if pollTask != nil { return }
        pollTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                guard case .connected = self.state else { continue }
                await self.loadArtifactsSafe()
                await self.loadRecordsSafe()
            }
        }
    }

    @MainActor
    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    @MainActor
    private func loadArtifactsSafe() async {
        try? await loadArtifacts()
    }

    @MainActor
    private func loadRecordsSafe() async {
        try? await loadRecords()
    }

}
