# Consumer ProGuard rules for :widget.

# Glance widget classes are loaded by name by the AppWidget framework / runtime.
-keep class * extends androidx.glance.appwidget.GlanceAppWidget { *; }
-keep class * extends androidx.glance.appwidget.GlanceAppWidgetReceiver { *; }

# Action callbacks are resolved via reflection by Glance's actionRunCallback.
-keep class * implements androidx.glance.appwidget.action.ActionCallback { *; }
