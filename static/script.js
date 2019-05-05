class Ride {
  constructor({map}) {
    this.map = map;
    this.coordSystem = map.options.get('projection').getCoordSystem();
    this.loopInterval = 0;
 }
  start() {
    this.getPoints()
      .then(() => this.initCar())
      .then(() => this.initFinalPoint())
      .then(() => ymaps.route([this.startPoint, this.wayPoint]))
      .then(route => this.drawRoute(route, this.startPoint, this.finalPoint, this.wayPoint))
      .then(points => ymaps.vow.delay(points, 1000))
      .then(points => this.goToPoint(points))
      .then(() => ymaps.route([this.wayPoint, this.finalPoint]))
      .then(route => this.drawRoute(route, this.wayPoint, this.finalPoint))
      .then(points => ymaps.vow.delay(points, 1000))
      .then(points => this.goToPoint(points))
      .then(() =>
        {
          this.finalPointObject.options.set(
            'iconContentLayout',
            ymaps.templateLayoutFactory.createClass('Маршрут выполнен')
          );
          this.map.panTo(this.finalPoint);
        }
      );
  }
  async getPoints() {
    const res = await fetch('/api');
    const data = await res.json();
    this.startPoint = data.start;
    this.wayPoint = data.middle;
    this.finalPoint = data.final;
  };
  initCar() {
    this.car = new ymaps.Placemark(this.startPoint, null, {
      iconImageHref: 'car.png',
      iconImageSize: [40, 22],
      iconImageOffset: [-20, -11],
      iconLayout: ymaps.templateLayoutFactory.createClass(
        [
          '<div style="transform:rotate({{options.rotate}}deg);">',
            '{% include "default#image" %}',
          '</div>'
        ].join('')
      ),
      iconRotate: 0,
    });
    this.map.geoObjects.add(this.car);
  }
  initFinalPoint() {
    this.finalPointObject = new ymaps.Placemark(this.finalPoint, {}, {
      preset: 'islands#darkGreenStretchyIcon',
      iconContentLayout: ymaps.templateLayoutFactory.createClass('... мин')
    });
    this.map.geoObjects.add(this.finalPointObject);
  }
  drawRoute(route, startPoint, finalPoint, wayPoint) {
    return new Promise(resolve => {
      // Получаем список всех сегментов
      // Из них получаем список всех промежуточных точек
      // И отрисовываем маршрут
      const segments = route.getPaths().get(0).getSegments();
      const {points, wayPoints} = this.getPathPoints(segments);
      this.path = new ymaps.Polyline(points, {}, {
        strokeColor: '#000000',
        strokeWidth: 4,
      });
      this.map.geoObjects.add(this.path);
      this.wayPointObject = (!wayPoint) ? null : new ymaps.Placemark(wayPoint, {}, {
        preset: 'islands#blackCircleDotIcon'
      });
      if(this.wayPointObject) this.map.geoObjects.add(this.wayPointObject);

      ymaps.route([startPoint, wayPoint, finalPoint].filter(it => it), {mapStateAutoApply: true})
        .then(route =>
          {
            this.finalPointObject.options.set(
              'iconContentLayout',
              ymaps.templateLayoutFactory.createClass(route.getHumanJamsTime())
            );
            this.map.setBounds(this.map.geoObjects.getBounds());
            resolve([wayPoints, finalPoint, wayPoint]);
          }
        );
    });
  }
  goToPoint([wayPoints, finalPoint, wayPoint]) {
    return new Promise(resolve => {
      this.finalPointUpdate = setInterval(
          () => {
            if(wayPoints.length < 10) return;
            ymaps.route([wayPoints[0].coords, wayPoint, finalPoint].filter(it => it))
                .then(route =>
                    this.finalPointObject.options.set(
                        'iconContentLayout',
                        ymaps.templateLayoutFactory.createClass(route.getHumanJamsTime())
                    )
                )
          }
          , 1000);

      const loopAnimation = (currentTime, previousTime) => {
        if (wayPoints.length) {
          if (!currentTime || (currentTime - previousTime) > this.loopInterval) {
            const pathPoint = wayPoints.shift();
            this.path.geometry.remove(0);
            if(pathPoint.angle !== this.car.options.get('iconRotate'))
              this.car.options.set('iconRotate', pathPoint.angle);
            this.car.geometry.setCoordinates(pathPoint.coords);
            previousTime = currentTime;
          }
          requestAnimationFrame((time) => {
            loopAnimation(time, previousTime || time)
          });
        }
        else {
          this.map.geoObjects.remove(this.path);
          if(this.wayPointObject) this.map.geoObjects.remove(this.wayPointObject);
          clearInterval(this.finalPointUpdate);
          resolve();
        }
      };
      loopAnimation();
    });
  }
  getPathPoints(segments) {
    const segmentsPoints = [];
    segments.forEach(
        segment => segment.getCoordinates().forEach(
            point => segmentsPoints.push(point)
        )
    );

    const points = [];
    const wayPoints = [];
    segmentsPoints.reduce(
        (from, to) => {
          const diff = [to[0] - from[0], to[1] - from[1]];
          const {startDirection, distance} = this.coordSystem.solveInverseProblem(from, to);
          const angle = this.getDirectionAngle(...startDirection);
          for (let i = 0; i < Math.round(distance); i += 3) {
            const coords = [
              from[0] + (diff[0] * i / distance),
              from[1] + (diff[1] * i / distance)
            ];
            points.push(coords);
            wayPoints.push({coords, angle});
          }
          return to;
        }
    );
    return {points, wayPoints};
  }
  getDirectionAngle(diffY, diffX){
    return -Math.atan2(diffY, diffX) * 180 / Math.PI;
  }
}
ymaps.ready(initMap);
function initMap() {
  const initPoint = [59.936328,30.313799];
  const map = new ymaps.Map("map", {
    center: initPoint,
    zoom: 10
  });
  const ride = new Ride({map});
  ride.start();
}

