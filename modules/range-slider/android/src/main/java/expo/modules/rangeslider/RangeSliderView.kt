package expo.modules.rangeslider

import android.content.Context
import android.graphics.Color
import android.view.ContextThemeWrapper
import android.view.MotionEvent
import android.widget.LinearLayout
import com.google.android.material.slider.RangeSlider
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class RangeSliderView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onValueChange by EventDispatcher()
  private val onSlidingComplete by EventDispatcher()

  private var minValue = 0f
  private var maxValue = 100f
  private var accentColor = Color.parseColor("#2997FF")

  private val themedContext = ContextThemeWrapper(context, com.google.android.material.R.style.Theme_Material3_DayNight)
  
  private val slider = RangeSlider(themedContext).apply {
    layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply {
      height = (60 * resources.displayMetrics.density).toInt()
    }
    
    valueFrom = 0f
    valueTo = 100f
    setValues(20f, 80f)
    stepSize = 0f // Remove steps discretos para não gerar ticks
    
    // Customização visual para ficar igual ao iOS
    trackHeight = (2 * resources.displayMetrics.density).toInt() // 2dp
    thumbRadius = (13 * resources.displayMetrics.density).toInt() // 24dp de diâmetro (12dp de raio)
    haloRadius = 0 // Remove o halo ao redor dos thumbs
    labelBehavior = com.google.android.material.slider.LabelFormatter.LABEL_GONE // Remove label/tooltip
    isTickVisible = false // Remove os pontos nas extremidades
    
    // Cores padrão (será sobrescrito pelo prop accentColor)
    val defaultAccent = Color.parseColor("#2997FF")
    thumbTintList = android.content.res.ColorStateList.valueOf(defaultAccent)
    trackActiveTintList = android.content.res.ColorStateList.valueOf(defaultAccent)
    trackInactiveTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#E5E5EA"))
    
    addOnChangeListener { slider, _, _ ->
      val values = slider.values
      onValueChange(mapOf(
        "minValue" to values[0].toInt(),
        "maxValue" to values[1].toInt()
      ))
    }
    
    // Fire onSlidingComplete when user releases the slider
    addOnSliderTouchListener(object : RangeSlider.OnSliderTouchListener {
      override fun onStartTrackingTouch(slider: RangeSlider) {}
      
      override fun onStopTrackingTouch(slider: RangeSlider) {
        val values = slider.values
        onSlidingComplete(mapOf(
          "minValue" to values[0].toInt(),
          "maxValue" to values[1].toInt()
        ))
      }
    })
  }

  init {
    addView(slider)
  }

  fun setMin(value: Float) {
    minValue = value
    slider.valueFrom = value
  }

  fun setMax(value: Float) {
    maxValue = value
    slider.valueTo = value
  }

  fun setLower(value: Float) {
    val current = slider.values
    slider.setValues(value, current[1])
  }

  fun setUpper(value: Float) {
    val current = slider.values
    slider.setValues(current[0], value)
  }

  fun setAccent(color: Int) {
    accentColor = color
    slider.thumbTintList = android.content.res.ColorStateList.valueOf(color)
    slider.trackActiveTintList = android.content.res.ColorStateList.valueOf(color)
  }
}
