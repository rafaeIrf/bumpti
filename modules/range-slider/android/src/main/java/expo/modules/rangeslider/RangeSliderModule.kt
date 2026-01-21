package expo.modules.rangeslider

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RangeSliderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RangeSlider")

    Events("onValueChange", "onSlidingComplete")

    View(RangeSliderView::class) {
      Prop("minValue") { view: RangeSliderView, value: Float ->
        view.setMin(value)
      }

      Prop("maxValue") { view: RangeSliderView, value: Float ->
        view.setMax(value)
      }

      Prop("lowerValue") { view: RangeSliderView, value: Float ->
        view.setLower(value)
      }

      Prop("upperValue") { view: RangeSliderView, value: Float ->
        view.setUpper(value)
      }

      Prop("accentColor") { view: RangeSliderView, color: Int ->
        view.setAccent(color)
      }

      Events("onValueChange", "onSlidingComplete")
    }
  }
}
