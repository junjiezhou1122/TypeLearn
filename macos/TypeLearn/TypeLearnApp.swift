import SwiftUI

@main
struct TypeLearnApp: App {
    @State private var appModel = AppModel()

    var body: some Scene {
        MenuBarExtra("TypeLearn", systemImage: "text.badge.checkmark") {
            ContentView(appModel: appModel)
        }
        .menuBarExtraStyle(.window)
    }
}
