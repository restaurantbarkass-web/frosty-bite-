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

include(":capacitor-android")
project(":capacitor-android").projectDir = file("node_modules/@capacitor/android/android")

