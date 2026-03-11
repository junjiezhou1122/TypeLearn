import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TypeLearn")
                .font(.headline)

            Text("Privacy-first English learning from your everyday typing.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Label("Menu bar shell ready", systemImage: "checkmark.circle")
                Label("Permissions flow pending", systemImage: "hand.raised")
                Label("Local service scaffolded", systemImage: "server.rack")
            }
            .font(.callout)
        }
        .padding(16)
        .frame(width: 320)
    }
}

#Preview {
    ContentView()
}
