import ExpoModulesCore
import UIKit

// Custom Range Slider with two thumbs for iOS
class RangeSliderView: ExpoView {
  // Events
  let onValueChange = EventDispatcher()
  let onSlidingComplete = EventDispatcher()
  
  // Private properties
  private var minValue: Float = 0
  private var maxValue: Float = 100
  private var lowerValue: Float = 20
  private var upperValue: Float = 80
  
  private var trackLayer = CALayer()
  private var lowerThumbLayer = CALayer()
  private var upperThumbLayer = CALayer()
  private var activeTrackLayer = CALayer()
  
  private var previousTouchLocation = CGPoint.zero
  private var trackingThumb: CALayer?
  private weak var parentScrollView: UIScrollView?
  
  private let thumbSize: CGFloat = 26
  private let trackHeight: CGFloat = 2
  
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupLayers()
  }
  
  private func setupLayers() {
    // Track layer (inactive)
    trackLayer.backgroundColor = UIColor.systemGray4.cgColor
    trackLayer.cornerRadius = trackHeight / 2
    layer.addSublayer(trackLayer)
    
    // Active track layer (between thumbs)
    activeTrackLayer.backgroundColor = UIColor.systemBlue.cgColor
    activeTrackLayer.cornerRadius = trackHeight / 2
    layer.addSublayer(activeTrackLayer)
    
    // Lower thumb
    lowerThumbLayer.backgroundColor = UIColor.systemBlue.cgColor
    lowerThumbLayer.cornerRadius = thumbSize / 2
    lowerThumbLayer.shadowColor = UIColor.black.cgColor
    lowerThumbLayer.shadowOpacity = 0.3
    lowerThumbLayer.shadowRadius = 4
    lowerThumbLayer.shadowOffset = CGSize(width: 0, height: 2)
    layer.addSublayer(lowerThumbLayer)
    
    // Upper thumb
    upperThumbLayer.backgroundColor = UIColor.systemBlue.cgColor
    upperThumbLayer.cornerRadius = thumbSize / 2
    upperThumbLayer.shadowColor = UIColor.black.cgColor
    upperThumbLayer.shadowOpacity = 0.3
    upperThumbLayer.shadowRadius = 4
    upperThumbLayer.shadowOffset = CGSize(width: 0, height: 2)
    layer.addSublayer(upperThumbLayer)
    
    updateLayerFrames()
  }
  
  override func layoutSubviews() {
    super.layoutSubviews()
    updateLayerFrames()
  }
  
  private func updateLayerFrames() {
    let trackWidth = bounds.width - thumbSize
    let trackY = (bounds.height - trackHeight) / 2
    
    // Track frame
    trackLayer.frame = CGRect(x: thumbSize / 2, y: trackY, width: trackWidth, height: trackHeight)
    
    // Calculate thumb positions
    let lowerPosition = positionForValue(lowerValue)
    let upperPosition = positionForValue(upperValue)
    
    // Lower thumb frame
    lowerThumbLayer.frame = CGRect(x: lowerPosition - thumbSize / 2, 
                                    y: (bounds.height - thumbSize) / 2,
                                    width: thumbSize, 
                                    height: thumbSize)
    
    // Upper thumb frame
    upperThumbLayer.frame = CGRect(x: upperPosition - thumbSize / 2,
                                    y: (bounds.height - thumbSize) / 2,
                                    width: thumbSize,
                                    height: thumbSize)
    
    // Active track frame (between thumbs)
    activeTrackLayer.frame = CGRect(x: lowerPosition,
                                     y: trackY,
                                     width: upperPosition - lowerPosition,
                                     height: trackHeight)
  }
  
  private func positionForValue(_ value: Float) -> CGFloat {
    let trackWidth = bounds.width - thumbSize
    let range = maxValue - minValue
    let relativeValue = value - minValue
    return thumbSize / 2 + CGFloat(relativeValue / range) * trackWidth
  }
  
  private func valueForPosition(_ position: CGFloat) -> Float {
    let trackWidth = bounds.width - thumbSize
    let relativePosition = position - thumbSize / 2
    let range = maxValue - minValue
    let value = minValue + Float(relativePosition / trackWidth) * range
    return min(max(value, minValue), maxValue)
  }
  
  private func findParentScrollView() -> UIScrollView? {
    var view = superview
    while view != nil {
      if let scrollView = view as? UIScrollView {
        return scrollView
      }
      view = view?.superview
    }
    return nil
  }
  
  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    guard let touch = touches.first else { return }
    let touchLocation = touch.location(in: self)
    previousTouchLocation = touchLocation
    
    // Aumenta a área de toque vertical para melhor usabilidade
    let expandedTouchArea: CGFloat = 44 // Área mínima recomendada pela Apple
    
    // Determine which thumb to track
    let lowerDistance = abs(touchLocation.x - lowerThumbLayer.frame.midX)
    let upperDistance = abs(touchLocation.x - upperThumbLayer.frame.midX)
    
    // Verifica se o toque está dentro da área expandida verticalmente
    let verticalDistance = abs(touchLocation.y - bounds.height / 2)
    if verticalDistance <= expandedTouchArea {
      trackingThumb = lowerDistance < upperDistance ? lowerThumbLayer : upperThumbLayer
      
      // Encontra e desabilita o scroll da ScrollView pai
      parentScrollView = findParentScrollView()
      parentScrollView?.isScrollEnabled = false
    }
  }
  
  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
    guard let touch = touches.first, let thumb = trackingThumb else { return }
    let touchLocation = touch.location(in: self)
    
    // Permite movimento vertical ilimitado - só usa a posição X
    let newValue = valueForPosition(touchLocation.x)
    
    if thumb === lowerThumbLayer {
      lowerValue = min(newValue, upperValue - Float(thumbSize) / Float(bounds.width) * (maxValue - minValue))
    } else {
      upperValue = max(newValue, lowerValue + Float(thumbSize) / Float(bounds.width) * (maxValue - minValue))
    }
    
    updateLayerFrames()
    
    // Send event in real-time while dragging
    onValueChange([
      "minValue": Int(lowerValue.rounded()),
      "maxValue": Int(upperValue.rounded())
    ])
  }
  
  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
    trackingThumb = nil
    
    // Reativa o scroll da ScrollView pai
    parentScrollView?.isScrollEnabled = true
    parentScrollView = nil
    
    // Fire sliding complete event when user releases
    onSlidingComplete([
      "minValue": Int(lowerValue.rounded()),
      "maxValue": Int(upperValue.rounded())
    ])
  }
  
  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
    trackingThumb = nil
    
    // Reativa o scroll da ScrollView pai
    parentScrollView?.isScrollEnabled = true
    parentScrollView = nil
  }
  
  // Public setters from React Native
  func setMinValue(_ value: Float) {
    minValue = value
    updateLayerFrames()
  }
  
  func setMaxValue(_ value: Float) {
    maxValue = value
    updateLayerFrames()
  }
  
  func setLowerValue(_ value: Float) {
    lowerValue = value
    updateLayerFrames()
  }
  
  func setUpperValue(_ value: Float) {
    upperValue = value
    updateLayerFrames()
  }
  
  func setAccentColor(_ color: UIColor) {
    activeTrackLayer.backgroundColor = color.cgColor
    lowerThumbLayer.backgroundColor = color.cgColor
    upperThumbLayer.backgroundColor = color.cgColor
  }
}
