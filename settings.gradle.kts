pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "FrostyBite"
include(":app")

// Ensure capacitor-android directory exists before configuration
val capacitorDir = file("node_modules/@capacitor/android/capacitor")
if (!capacitorDir.exists()) {
    println("[Gradle Settings] Capacitor android directory not found. Installing node packages programmatically...")
    try {
        val osName = System.getProperty("os.name").lowercase()
        val isWindows = osName.contains("win")
        val npmCmd = if (isWindows) listOf("cmd", "/c", "npm", "install") else listOf("npm", "install")
        
        val process = ProcessBuilder(npmCmd)
            .directory(rootDir)
            .redirectOutput(ProcessBuilder.Redirect.INHERIT)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        process.waitFor()
    } catch (e: Exception) {
        println("[Gradle Settings] Failed to run npm install programmatically: ${e.message}")
    }
    
    // Fallback: If npm install still couldn't run or create it, create a mock folder so Gradle configuration doesn't crash
    if (!capacitorDir.exists()) {
        println("[Gradle Settings] Warning: mock dir fallback because node_modules/@capacitor/android/capacitor is missing")
        capacitorDir.mkdirs()
    }
}

include(":capacitor-android")
project(":capacitor-android").projectDir = file("node_modules/@capacitor/android/capacitor")

