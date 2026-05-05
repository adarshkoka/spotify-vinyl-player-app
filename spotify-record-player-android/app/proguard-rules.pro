# Project-specific ProGuard rules. Add as features are introduced.

# Media3 reflection — keep MediaLibraryService and SimpleBasePlayer-related APIs.
-keep class androidx.media3.** { *; }
-keep class com.google.common.util.concurrent.** { *; }

# Moshi-generated adapters (KSP).
-keep class **JsonAdapter { *; }

# Hilt
-keep class * extends dagger.hilt.android.internal.lifecycle.HiltViewModelFactory { *; }
