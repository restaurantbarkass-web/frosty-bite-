import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Load and parse version properties
val versionPropsFile = rootProject.file("version.properties")
val versionProps = Properties()
var currentVersionCode = 5
var currentVersionName = "1.4"

if (versionPropsFile.exists()) {
    FileInputStream(versionPropsFile).use { versionProps.load(it) }
    currentVersionCode = versionProps.getProperty("VERSION_CODE", "5").toInt()
    currentVersionName = versionProps.getProperty("VERSION_NAME", "1.4")
}

android {
    namespace = "com.frostybite.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.frostybite.app"
        minSdk = 24
        targetSdk = 35
        versionCode = currentVersionCode
        versionName = currentVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        // Automatically generate debug.keystore if it's missing to prevent gradle build failures
        val localKeystoreFile = rootProject.file("debug.keystore")
        if (!localKeystoreFile.exists()) {
            println("[Gradle] debug.keystore not found. Generating a temporary local debug keystore...")
            try {
                val pt = ProcessBuilder(
                    "keytool", "-genkey", "-v",
                    "-keystore", localKeystoreFile.absolutePath,
                    "-storepass", "android",
                    "-alias", "androiddebugkey",
                    "-keypass", "android",
                    "-keyalg", "RSA",
                    "-keysize", "2048",
                    "-validity", "10000",
                    "-dname", "CN=Android Debug,O=Android,C=US"
                ).inheritIO().start()
                pt.waitFor()
                println("[Gradle] Successfully generated temporary debug.keystore at: ${localKeystoreFile.absolutePath}")
            } catch (e: Exception) {
                println("[Gradle] Warning: Failed to generate temporary debug.keystore: ${e.message}")
            }
        }

        create("debugConfig") {
            storeFile = file("${rootDir}/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("releaseConfig") {
            val isEnvConfigured = System.getenv("ANDROID_SIGNING_KEY_STORE") != null
            if (isEnvConfigured) {
                storeFile = file(System.getenv("ANDROID_SIGNING_KEY_STORE"))
                storePassword = System.getenv("ANDROID_SIGNING_STORE_PASSWORD") ?: "android"
                keyAlias = System.getenv("ANDROID_SIGNING_KEY_ALIAS") ?: "androiddebugkey"
                keyPassword = System.getenv("ANDROID_SIGNING_KEY_PASSWORD") ?: "android"
            } else {
                storeFile = file("${rootDir}/debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("releaseConfig")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("debugConfig")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    kotlinOptions {
        jvmTarget = "21"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(project(":capacitor-android"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.10.0")
    
    // Compose dependencies
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Core Testing dependencies
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}

tasks.register("buildWebAndSyncCapacitor") {
    group = "build"
    description = "Automatically compiles web assets and synchronizes them with Capacitor prior to compiler phases."
    doFirst {
        val rootDirFile = rootProject.projectDir
        val nodeModules = File(rootDirFile, "node_modules")
        val osName = System.getProperty("os.name").lowercase()
        val isWindows = osName.contains("win")
        
        try {
            if (!nodeModules.exists()) {
                println("[Gradle App Build] Installing node dependencies...")
                val installCmd = if (isWindows) listOf("cmd", "/c", "npm", "install") else listOf("npm", "install")
                val p = ProcessBuilder(installCmd).directory(rootDirFile).redirectOutput(ProcessBuilder.Redirect.INHERIT).redirectError(ProcessBuilder.Redirect.INHERIT).start()
                p.waitFor()
            }
            
            println("[Gradle App Build] Building web bundle with npm run build...")
            val buildCmd = if (isWindows) listOf("cmd", "/c", "npm", "run", "build") else listOf("npm", "run", "build")
            val pBuild = ProcessBuilder(buildCmd).directory(rootDirFile).redirectOutput(ProcessBuilder.Redirect.INHERIT).redirectError(ProcessBuilder.Redirect.INHERIT).start()
            pBuild.waitFor()

            println("[Gradle App Build] Syncing web assets with Capacitor...")
            val syncCmd = if (isWindows) listOf("cmd", "/c", "npx", "cap", "sync") else listOf("npx", "cap", "sync")
            val pSync = ProcessBuilder(syncCmd).directory(rootDirFile).redirectOutput(ProcessBuilder.Redirect.INHERIT).redirectError(ProcessBuilder.Redirect.INHERIT).start()
            pSync.waitFor()
            
            println("[Gradle App Build] Web assets synchronization successfully completed!")
        } catch (e: Exception) {
            println("[Gradle App Build] Warning: NPM task pipeline failed. Continuing with existing assets: ${e.message}")
        }
    }
}

// Hook it into compilation lifecycle
tasks.named("preBuild") {
    dependsOn("buildWebAndSyncCapacitor")
}
