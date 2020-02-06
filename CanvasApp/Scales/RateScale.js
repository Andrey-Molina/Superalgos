function newRateScale () {
  const MODULE_NAME = 'Right Scale'

  let thisObject = {
    container: undefined,
    rate: undefined,
    fitFunction: undefined,
    payload: undefined,
    scale: undefined,
    offset: undefined,
    minValue: undefined,
    maxValue: undefined,
    isVisible: true,
    layersOn: undefined,
    setScale: setScale,
    onMouseOverSomeTimeMachineContainer: onMouseOverSomeTimeMachineContainer,
    physics: physics,
    draw: draw,
    drawForeground: drawForeground,
    getContainer: getContainer,
    initialize: initialize,
    finalize: finalize
  }

  const DEFAULT_SCALE = 50
  const STEP_SCALE = 1
  const MIN_SCALE = 0
  const MAX_SCALE = 100
  const SNAP_THRESHOLD_SCALE = 1

  const DEFAULT_OFFSET = 0
  const STEP_OFFSET = 1
  const MIN_OFFSET = -1000
  const MAX_OFFSET = 1000
  const SNAP_THRESHOLD_OFFSET = 3

  thisObject.container = newContainer()
  thisObject.container.initialize(MODULE_NAME)

  thisObject.container.isDraggeable = false
  thisObject.container.isClickeable = false
  thisObject.container.isWheelable = true
  thisObject.container.detectMouseOver = true

  thisObject.container.frame.width = UI_PANEL.WIDTH.NORMAL
  thisObject.container.frame.height = 40

  thisObject.offset = DEFAULT_OFFSET

  let visible = true
  let isMouseOver

  let onMouseWheelEventSubscriptionId
  let onMouseOverEventSubscriptionId
  let onMouseNotOverEventSubscriptionId

  let coordinateSystem
  let limitingContainer
  let rateCalculationsContainer

  let mouse = {
    position: {
      x: 0,
      y: 0
    }
  }

  let offsetTimer = 0
  let scaleTimer = 0
  return thisObject

  function finalize () {
    thisObject.container.eventHandler.stopListening(onMouseWheelEventSubscriptionId)
    thisObject.container.eventHandler.stopListening(onMouseOverEventSubscriptionId)
    thisObject.container.eventHandler.stopListening(onMouseNotOverEventSubscriptionId)

    thisObject.container.finalize()
    thisObject.container = undefined
    thisObject.fitFunction = undefined
    thisObject.payload = undefined

    coordinateSystem = undefined
    limitingContainer = undefined
    rateCalculationsContainer = undefined
    mouse = undefined
  }

  function initialize (pCoordinateSystem, pLimitingContainer, pRateCalculationsContainer) {
    coordinateSystem = pCoordinateSystem
    limitingContainer = pLimitingContainer
    rateCalculationsContainer = pRateCalculationsContainer

    thisObject.minValue = coordinateSystem.min.y
    thisObject.maxValue = coordinateSystem.max.y

    onMouseWheelEventSubscriptionId = thisObject.container.eventHandler.listenToEvent('onMouseWheel', onMouseWheel)
    onMouseOverEventSubscriptionId = thisObject.container.eventHandler.listenToEvent('onMouseOver', onMouseOver)
    onMouseNotOverEventSubscriptionId = thisObject.container.eventHandler.listenToEvent('onMouseNotOver', onMouseNotOver)

    thisObject.scale = DEFAULT_SCALE
    readObjectState()

    let event = {}
    event.scale = thisObject.scale
    thisObject.container.eventHandler.raiseEvent('Rate Scale Value Changed', event)
  }

  function onMouseOverSomeTimeMachineContainer (event) {
    if (event.containerId === undefined) {
      /* This happens when the mouse over was not at the instance of a certain scale, but anywhere else. */
      visible = true
    } else {
      if (event.containerId === thisObject.container.id) {
        visible = true
      } else {
        visible = false
        turnOnCounter = 0
      }
    }
    mouse = {
      position: {
        x: event.x,
        y: event.y
      }
    }
  }

  function onMouseOver (event) {
    isMouseOver = true
    event.containerId = thisObject.container.id
    thisObject.container.eventHandler.raiseEvent('onMouseOverScale', event)
  }

  function onMouseNotOver () {
    isMouseOver = false
    offsetTimer = 0
    scaleTimer = 0
  }

  function onMouseWheel (event) {
    let morePower = 1
    let delta

    if (event.shiftKey === true) {
      if (event.buttons === 4) { morePower = 10 } // Mouse wheel pressed.
      delta = event.wheelDelta
      if (delta < 0) {
        thisObject.offset = thisObject.offset - STEP_OFFSET * morePower
        if (thisObject.offset < MIN_OFFSET) { thisObject.offset = STEP_OFFSET }
      } else {
        thisObject.offset = thisObject.offset + STEP_OFFSET * morePower
        if (thisObject.offset > MAX_OFFSET) { thisObject.offset = MAX_OFFSET }
      }

      if (
        thisObject.offset <= DEFAULT_OFFSET + SNAP_THRESHOLD_OFFSET &&
        thisObject.offset >= DEFAULT_OFFSET - SNAP_THRESHOLD_OFFSET
      ) {
        event.offset = 0
      } else {
        event.offset = -thisObject.offset
      }

      event.isUserAction = true
      thisObject.container.eventHandler.raiseEvent('Rate Scale Offset Changed', event)

      saveObjectState()
      offsetTimer = 100
      scaleTimer = 0
    } else {
      if (event.buttons === 4) { morePower = 5 } // Mouse wheel pressed.
      delta = event.wheelDelta
      if (delta < 0) {
        thisObject.scale = thisObject.scale - STEP_SCALE * morePower
        if (thisObject.scale < MIN_SCALE) { thisObject.scale = MIN_SCALE }
      } else {
        thisObject.scale = thisObject.scale + STEP_SCALE * morePower
        if (thisObject.scale > MAX_SCALE) { thisObject.scale = MAX_SCALE }
      }

      finishScaleChange(event)
    }
  }

  function setScale (scale) {
    thisObject.scale = scale
    let event = {}
    finishScaleChange(event)
  }

  function finishScaleChange (event) {
    if (
      thisObject.scale <= DEFAULT_SCALE + SNAP_THRESHOLD_SCALE &&
      thisObject.scale >= DEFAULT_SCALE - SNAP_THRESHOLD_SCALE
    ) {
      event.scale = DEFAULT_SCALE
    } else {
      event.scale = thisObject.scale
    }
    event.isUserAction = true
    thisObject.container.eventHandler.raiseEvent('Rate Scale Value Changed', event)

    saveObjectState()
    offsetTimer = 0
    scaleTimer = 100
  }

  function getContainer (point) {
    if (thisObject.container.frame.isThisPointHere(point, true) === true) {
      return thisObject.container
    }
  }

  function saveObjectState () {
    try {
      let code = JSON.parse(thisObject.payload.node.code)
      code.scale = thisObject.scale / MAX_SCALE * 100
      code.scale = code.scale.toFixed(0)
      code.offset = thisObject.offset
      code.minValue = thisObject.minValue
      code.maxValue = thisObject.maxValue
      thisObject.payload.node.code = JSON.stringify(code, null, 4)
    } catch (err) {
       // we ignore errors here since most likely they will be parsing errors.
    }
  }

  function readObjectState () {
    try {
      let code = JSON.parse(thisObject.payload.node.code)

      if (isNaN(code.scale) || code.scale === null || code.scale === undefined) {
        // not using this value
      } else {
        code.scale = code.scale / 100 * MAX_SCALE
        if (code.scale < MIN_SCALE) { code.scale = MIN_SCALE }
        if (code.scale > MAX_SCALE) { code.scale = MAX_SCALE }

        if (code.scale !== thisObject.scale) {
          thisObject.scale = code.scale
          let event = {}
          if (
            thisObject.scale <= DEFAULT_SCALE + SNAP_THRESHOLD_SCALE &&
            thisObject.scale >= DEFAULT_SCALE - SNAP_THRESHOLD_SCALE
          ) {
            event.scale = DEFAULT_SCALE
          } else {
            event.scale = thisObject.scale
          }
          thisObject.container.eventHandler.raiseEvent('Rate Scale Value Changed', event)
        }
      }

      if (isNaN(code.offset) || code.offset === null || code.offset === undefined) {
        // not using this value
      } else {
        if (code.offset < MIN_OFFSET) { code.offset = MIN_OFFSET }
        if (code.offset > MAX_OFFSET) { code.offset = MAX_OFFSET }

        if (code.offset !== thisObject.offset) {
          thisObject.offset = code.offset
          let event = {}
          if (
            thisObject.offset <= DEFAULT_OFFSET + SNAP_THRESHOLD_OFFSET &&
            thisObject.offset >= DEFAULT_OFFSET - SNAP_THRESHOLD_OFFSET
          ) {
            event.offset = 0
          } else {
            event.offset = -thisObject.offset
          }
          thisObject.container.eventHandler.raiseEvent('Rate Scale Offset Changed', event)
        }
      }

      if (
      (isNaN(code.minValue) || code.minValue === null || code.minValue === undefined) ||
      (isNaN(code.maxValue) || code.maxValue === null || code.maxValue === undefined)
        ) {
        // not using this value
      } else {
        if (thisObject.minValue !== code.minValue || thisObject.maxValue !== code.maxValue) {
          thisObject.minValue = code.minValue
          thisObject.maxValue = code.maxValue
          coordinateSystem.min.y = thisObject.minValue
          coordinateSystem.max.y = thisObject.maxValue
          coordinateSystem.recalculateScale()
        }
      }
      saveObjectState() // this overrides any invalid value at the config.
    } catch (err) {
       // we ignore errors here since most likely they will be parsing errors.
    }
  }

  function physics () {
    offsetTimer--
    scaleTimer--
    readObjectState()
    positioningPhysics()
  }

  function positioningPhysics () {
    /* Container Limits */

    let upCorner = {
      x: 0,
      y: 0
    }

    let bottonCorner = {
      x: limitingContainer.frame.width,
      y: limitingContainer.frame.height
    }

    upCorner = transformThisPoint(upCorner, limitingContainer)
    bottonCorner = transformThisPoint(bottonCorner, limitingContainer)

    upCorner = limitingContainer.fitFunction(upCorner, true)
    bottonCorner = limitingContainer.fitFunction(bottonCorner, true)

    /* We will check if we need to change the bottom because of being one of many scales of the same type */
    let displaceFactor = 0
    if (thisObject.payload.parentNode === undefined) { return } // This happens when in the process of deleting the scale, timeline chart or time machine.
    if (thisObject.payload.parentNode.type === 'Timeline Chart') {
      if (thisObject.payload.parentNode.payload.parentNode !== undefined) {
        if (thisObject.payload.parentNode.payload.parentNode.rateScale !== undefined) {
          if (thisObject.payload.parentNode.payload.parentNode.rateScale.payload.isVisible === true) {
            displaceFactor++
          }
        }
        for (let i = 0; i < thisObject.payload.parentNode.payload.parentNode.timelineCharts.length; i++) {
          let timelineChart = thisObject.payload.parentNode.payload.parentNode.timelineCharts[i]
          if (timelineChart.rateScale !== undefined) {
            if (thisObject.payload.node.id !== timelineChart.rateScale.id) {
              if (timelineChart.rateScale.payload.isVisible === true) {
                displaceFactor++
              }
            } else {
              break
            }
          }
        }
      }
    }
    bottonCorner.x = bottonCorner.x - thisObject.container.frame.width * displaceFactor

    /* Mouse Position Rate Calculation */
    let ratePoint = {
      x: 0,
      y: mouse.position.y + thisObject.offset
    }

    thisObject.rate = getRateFromPoint(ratePoint, rateCalculationsContainer, coordinateSystem)

    /* rateScale Positioning */
    ratePoint = {
      x: limitingContainer.frame.width,
      y: 0
    }

    ratePoint = transformThisPoint(ratePoint, limitingContainer.frame.container)
    ratePoint.y = mouse.position.y - thisObject.container.frame.height / 2 + thisObject.container.frame.height

    /* Checking against the container limits. */
    if (ratePoint.x < upCorner.x) { ratePoint.x = upCorner.x }
    if (ratePoint.x + thisObject.container.frame.width > bottonCorner.x) { ratePoint.x = bottonCorner.x }
    if (ratePoint.y < upCorner.y + thisObject.container.frame.height) { ratePoint.y = upCorner.y + thisObject.container.frame.height }
    if (ratePoint.y > bottonCorner.y) { ratePoint.y = bottonCorner.y }

    thisObject.container.frame.position.y = ratePoint.y - thisObject.container.frame.height
    thisObject.container.frame.position.x = ratePoint.x - thisObject.container.frame.width

    thisObject.isVisible = true
    thisObject.payload.isVisible = true
    if (thisObject.container.frame.position.y + thisObject.container.frame.height * 2 > bottonCorner.y ||
        thisObject.container.frame.position.y - thisObject.container.frame.height * 1 < upCorner.y ||
        thisObject.container.frame.position.x < upCorner.x
      ) {
      thisObject.isVisible = false
      thisObject.payload.isVisible = false
    }
    if (thisObject.layersOn === 0) {
      thisObject.isVisible = false
      thisObject.payload.isVisible = false
    }
  }

  function draw () {
    drawScaleBox()
    if (visible === false) {
      drawScaleDisplayCover(thisObject.container)
    }
  }

  function drawForeground () {
    if (isMouseOver === true) {
      drawScaleBox()
      drawArrows()
    }
  }

  function drawScaleBox () {
    if (thisObject.rate === undefined) { return }

    let rate = thisObject.rate

    if (rate < coordinateSystem.min.y) {
      rate = coordinateSystem.min.y
    }
    if (rate > coordinateSystem.max.y) {
      rate = coordinateSystem.max.y
    }

    let label = (rate - Math.trunc(rate)).toFixed(2)
    let labelArray = label.split('.')
    let label1 = thisObject.payload.node.payload.parentNode.name
    let label2 = (Math.trunc(rate)).toLocaleString()
    let label3 = labelArray[1]

    let icon1 = canvas.designerSpace.iconByUiObjectType.get(thisObject.payload.node.payload.parentNode.type)
    let icon2 = canvas.designerSpace.iconByUiObjectType.get(thisObject.payload.node.type)

    let backgroundColor = UI_COLOR.BLACK

    if (offsetTimer > 0) {
      label2 = thisObject.offset.toFixed(0)
      label3 = 'OFFSET'
    }

    if (scaleTimer > 0) {
      label2 = (thisObject.scale / MAX_SCALE * 100).toFixed(0)
      label3 = 'SCALE'
    }

    drawScaleDisplay(label1, label2, label3, 0, 0, 0, icon1, icon2, thisObject.container, backgroundColor)
  }

  function drawArrows () {
    if (visible === false || thisObject.rate === undefined) { return }

    const X_OFFSET = thisObject.container.frame.width / 2
    const Y_OFFSET = thisObject.container.frame.height / 2
    const HEIGHT = 6
    const WIDTH = 18
    const LINE_WIDTH = 3
    const OPACITY = 0.2
    const DISTANCE_BETWEEN_ARROWS = 10
    const MIN_DISTANCE_FROM_CENTER = 30
    const CURRENT_SCALE_DISTANCE = MIN_DISTANCE_FROM_CENTER + thisObject.scale
    const MAX_DISTANCE_FROM_CENTER = MIN_DISTANCE_FROM_CENTER + 215 + DISTANCE_BETWEEN_ARROWS

    let ARROW_DIRECTION = 0

    ARROW_DIRECTION = -1
    drawTwoArrows()
    ARROW_DIRECTION = 1
    drawTwoArrows()

    function drawTwoArrows () {
      point1 = {
        x: X_OFFSET - WIDTH / 2,
        y: Y_OFFSET + DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + CURRENT_SCALE_DISTANCE * ARROW_DIRECTION
      }

      point2 = {
        x: X_OFFSET,
        y: Y_OFFSET + HEIGHT * ARROW_DIRECTION + DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + CURRENT_SCALE_DISTANCE * ARROW_DIRECTION
      }

      point3 = {
        x: X_OFFSET + WIDTH / 2,
        y: Y_OFFSET + DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + CURRENT_SCALE_DISTANCE * ARROW_DIRECTION
      }

      point1 = thisObject.container.frame.frameThisPoint(point1)
      point2 = thisObject.container.frame.frameThisPoint(point2)
      point3 = thisObject.container.frame.frameThisPoint(point3)

      point4 = {
        x: X_OFFSET - WIDTH / 2,
        y: Y_OFFSET - DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + CURRENT_SCALE_DISTANCE * ARROW_DIRECTION
      }

      point5 = {
        x: X_OFFSET,
        y: Y_OFFSET + HEIGHT * ARROW_DIRECTION - DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + CURRENT_SCALE_DISTANCE * ARROW_DIRECTION
      }

      point6 = {
        x: X_OFFSET + WIDTH / 2,
        y: Y_OFFSET - DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + CURRENT_SCALE_DISTANCE * ARROW_DIRECTION
      }

      point4 = thisObject.container.frame.frameThisPoint(point4)
      point5 = thisObject.container.frame.frameThisPoint(point5)
      point6 = thisObject.container.frame.frameThisPoint(point6)

      point7 = {
        x: X_OFFSET - WIDTH / 2,
        y: Y_OFFSET - DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + MAX_DISTANCE_FROM_CENTER * ARROW_DIRECTION
      }

      point8 = {
        x: X_OFFSET,
        y: Y_OFFSET - HEIGHT * ARROW_DIRECTION - DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + MAX_DISTANCE_FROM_CENTER * ARROW_DIRECTION
      }

      point9 = {
        x: X_OFFSET + WIDTH / 2,
        y: Y_OFFSET - DISTANCE_BETWEEN_ARROWS / 2 * ARROW_DIRECTION + MAX_DISTANCE_FROM_CENTER * ARROW_DIRECTION
      }

      point7 = thisObject.container.frame.frameThisPoint(point7)
      point8 = thisObject.container.frame.frameThisPoint(point8)
      point9 = thisObject.container.frame.frameThisPoint(point9)

      browserCanvasContext.setLineDash([0, 0])

      browserCanvasContext.beginPath()

      browserCanvasContext.moveTo(point1.x, point1.y)
      browserCanvasContext.lineTo(point2.x, point2.y)
      browserCanvasContext.lineTo(point3.x, point3.y)

      browserCanvasContext.moveTo(point4.x, point4.y)
      browserCanvasContext.lineTo(point5.x, point5.y)
      browserCanvasContext.lineTo(point6.x, point6.y)

      browserCanvasContext.moveTo(point7.x, point7.y)
      browserCanvasContext.lineTo(point8.x, point8.y)
      browserCanvasContext.lineTo(point9.x, point9.y)

      browserCanvasContext.lineWidth = LINE_WIDTH
      browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.DARK + ', ' + OPACITY + ')'
      browserCanvasContext.stroke()
    }
  }
}