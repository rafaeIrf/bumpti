import ExpoModulesCore

public class RangeSliderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RangeSlider")

    // Defines event names that the module can send to JavaScript
    Events("onValueChange", "onSlidingComplete")

    // Native view component
    View(RangeSliderView.self) {
      // Props
      Prop("minValue") { (view: RangeSliderView, value: Float) in
        view.setMinValue(value)
      }
      
      Prop("maxValue") { (view: RangeSliderView, value: Float) in
        view.setMaxValue(value)
      }
      
      Prop("lowerValue") { (view: RangeSliderView, value: Float) in
        view.setLowerValue(value)
      }
      
      Prop("upperValue") { (view: RangeSliderView, value: Float) in
        view.setUpperValue(value)
      }
      
      Prop("accentColor") { (view: RangeSliderView, color: UIColor) in
        view.setAccentColor(color)
      }

      // Events
      Events("onValueChange", "onSlidingComplete")
    }
  }
}
