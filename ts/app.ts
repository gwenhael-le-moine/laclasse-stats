// Declare app level module which depends on filters, and services
angular.module('statsApp',
               [
  'ui.bootstrap',
  'nvd3',
  'angularMoment'
])
  .run(['amMoment', function(amMoment) { amMoment.changeLocale('fr'); }])
  .config(['$httpProvider', function(provider) { provider.defaults.withCredentials = true; }])
  .config(['$httpProvider',
           function($httpProvider) {
             $httpProvider.defaults.useXDomain = true;
             $httpProvider.defaults.withCredentials = true;

             $httpProvider.interceptors.push(['$q', '$window',
                                              function($q, $window) {
                                                return {
                                                  'responseError': function(rejection) {
                                                    if (rejection.status === 401) {
                                                      $window.location.href = '/sso/login?ticket=false&service=' + encodeURIComponent($window.location.href);
                                                    }
                                                    return rejection;
                                                  }
                                                };
                                              }]);
           }])
  .component("loaderSpinner",
             {
template: `
<style>
  .loader,
  .loader:before,
  .loader:after {
  border-radius: 50%;
  }
  .loader {
  color: #1aaacc;
  font-size: 11px;
  text-indent: -99999em;
  margin: 55px auto;
  position: relative;
  width: 10em;
  height: 10em;
  box-shadow: inset 0 0 0 1em;
  -webkit-transform: translateZ(0);
  -ms-transform: translateZ(0);
  transform: translateZ(0);
  }
  .loader:before,
  .loader:after {
  position: absolute;
  content: '';
  }
  .loader:before {
  width: 5.2em;
  height: 10.2em;
  background: #ffffff;
  border-radius: 10.2em 0 0 10.2em;
  top: -0.1em;
  left: -0.1em;
  -webkit-transform-origin: 5.2em 5.1em;
  transform-origin: 5.2em 5.1em;
  -webkit-animation: load2 2s infinite ease 1.5s;
  animation: load2 2s infinite ease 1.5s;
  }
  .loader:after {
  width: 5.2em;
  height: 10.2em;
  background: #ffffff;
  border-radius: 0 10.2em 10.2em 0;
  top: -0.1em;
  left: 5.1em;
  -webkit-transform-origin: 0px 5.1em;
  transform-origin: 0px 5.1em;
  -webkit-animation: load2 2s infinite ease;
  animation: load2 2s infinite ease;
  }
  @-webkit-keyframes load2 {
  0% {
  -webkit-transform: rotate(0deg);
  transform: rotate(0deg);
  }
  100% {
  -webkit-transform: rotate(360deg);
  transform: rotate(360deg);
  }
  }
  @keyframes load2 {
  0% {
  -webkit-transform: rotate(0deg);
  transform: rotate(0deg);
  }
  100% {
  -webkit-transform: rotate(360deg);
  transform: rotate(360deg);
  }
  }
</style>
<div class="loader">Loading...</div>
`})
  .component('stats',
             {
    controller: ['$http', '$locale', '$q', 'moment', 'URL_ENT',
                 function($http, $locale, $q, moment, URL_ENT) {
                   let ctrl = this;
                   ctrl.allowed = false;
                   ctrl.loading = false;

                   ctrl.period = {
                     decr: function() {
                       ctrl.debut.subtract(1, `${ctrl.period_types.selected}s`);
                       ctrl.fin = ctrl.debut.clone().endOf(ctrl.period_types.selected);
                     },

                     incr: function() {
                       ctrl.debut.add(1, `${ctrl.period_types.selected}s`);
                       ctrl.fin = ctrl.debut.clone().endOf(ctrl.period_types.selected);
                     },

                     reset: function() {
                       ctrl.debut = moment().startOf(ctrl.period_types.selected);
                       ctrl.fin = ctrl.debut.clone().endOf(ctrl.period_types.selected);
                     }
                   };

                   ctrl.types_labels = {
                     structure_id: 'Établissements',
                     application_id: 'Tuiles',
                     profil_id: 'Profils',
                     user_id: 'Utilisateurs',
                     weekday: 'Jours',
                     hour: 'Heures',
                     url: 'URLs'
                   };

                   ctrl.period_types = {
                     list: [
                       { label: 'journée', value: 'day' },
                       { label: 'semaine', value: 'week' },
                       { label: 'mois', value: 'month' },
                       { label: 'année', value: 'year' }
                     ],
                     selected: 'week'
                   };

                   ["cities", "structures_types", "profiles_types", "structures", "applications"].forEach((key) => { ctrl[key] = { list: [], selected: [] }; })

                   ctrl.multibarchart_options = {
                     chart: {
                       type: 'multiBarChart',
                       x: (d) => { return d.x },
                       y: (d) => { return d.y },
                       valueFormat: (v) => { return v; },
                       height: 256,
                       width: 1050,
                       margin: {
                         left: 50,
                         top: 20,
                         bottom: 100,
                         right: 20
                       },
                       showControls: false,
                       showValues: true,
                       showLegend: true,
                       stacked: false,
                       duration: 500,
                       labelThreshold: 0.01,
                       labelSunbeamLayout: true,
                       rotateLabels: -25,
                       reduceXTicks: false,
                       yAxis: {
                         tickFormat: (v) => d3.format(',.0f')(v)
                       },
                       xAxis: {}
                     }
                   };
                   ctrl.multibarhorizontalchart_options = angular.copy(ctrl.multibarchart_options);
                   ctrl.multibarhorizontalchart_options.chart.type = 'multiBarHorizontalChart';
                   ctrl.multibarhorizontalchart_options.chart.height = 512;
                   ctrl.multibarhorizontalchart_options.chart.margin = {
                     left: 250,
                     top: 20,
                     bottom: 20,
                     right: 50
                   };

                   ctrl.chart_options = function(type, data) {
                     switch (type) {
                       case "structure_id":
                       case "profil_id":
                         let left_margin = _.chain(data[0].values).pluck('x').map(function(label) { return label.length; }).max().value() * 8;
                         left_margin = left_margin > 250 ? 250 : left_margin;

                         ctrl.multibarhorizontalchart_options.chart.height = 24 * data.length * data[0].values.length + 40;
                         ctrl.multibarhorizontalchart_options.chart.margin.left = left_margin;
                         ctrl.multibarhorizontalchart_options.chart.xAxis.orient = "left";
                         ctrl.multibarhorizontalchart_options.chart.showXAxis = true;

                         return ctrl.multibarhorizontalchart_options;
                       case "url":
                         ctrl.multibarhorizontalchart_options.chart.height = 24 * data.length * data[0].values.length + 40;
                         // ctrl.multibarhorizontalchart_options.chart.showXAxis = false;
                         ctrl.multibarhorizontalchart_options.chart.xAxis.orient = "right";
                         ctrl.multibarhorizontalchart_options.chart.margin.left = 10;

                         return ctrl.multibarhorizontalchart_options;
                       default:
                         return ctrl.multibarchart_options;
                     }
                   };

                   ctrl.labels = {
                     weekday: _.memoize((nb) => {
                       let week_days = angular.copy($locale.DATETIME_FORMATS.DAY);
                       week_days.push(week_days.shift());

                       return `${nb} ${week_days[nb]}`;
                     }),
                     hour: (h) => {
                       if (h < 10) {
                         h = `0${h}`;
                       }
                       return `${h}:00 - ${h}:59`;
                     },
                     url: angular.identity,
                   };

                   ctrl.process_data = function(data) {
                     ctrl.logs = _(data).map((log) => {
                       log.timestamp = moment(log.timestamp);

                       log.weekday = log.timestamp.day();
                       log.hour = log.timestamp.hour();

                       return log;
                     });
                     ctrl.logs_SSO = _(ctrl.logs).where({ application_id: "SSO" });

                     let session_cutoff = moment().subtract(4, "hours");
                     ctrl.totals = {
                       clicks: ctrl.logs.length,
                       users: _.chain(ctrl.logs).countBy((log) => log.user_id).size().value(),
                       connections: ctrl.logs_SSO.length,
                       active_connections: _(ctrl.logs_SSO).select((connection) => connection.timestamp.isAfter(session_cutoff)).length,
                     };

                     ctrl.logs = _(ctrl.logs).reject((logline) => { return logline.application_id == "SSO"; })
                     ctrl.log_structures = _.chain(ctrl.logs).pluck("structure_id").uniq().map((structure_id) => _(ctrl.structures).findWhere({ id: structure_id })).value();
                     ctrl.log_applications = _.chain(ctrl.logs).pluck("application_id").uniq().map((application_id) => _(ctrl.applications).findWhere({ id: application_id })).value();
                     ctrl.log_profiles_types = _.chain(ctrl.logs).pluck("profil_id").uniq().map((profile_id) => _(ctrl.profiles_types).findWhere({ id: profile_id })).value();

                     ctrl.stats = _.chain(['structure_id', 'application_id', 'profil_id', 'weekday', 'hour', 'url'])
                       .map(function(key) {
                         let values = _.chain(ctrl.logs).select((logline) => { return key != "url" || logline[key].match(/^http.*/) != null; }).countBy(key).value();
                         return [
                           key,
                           [{
                             key: "clicks",
                             values: _.chain(values)
                               .keys()
                               .map(function(subkey) {
                                 return {
                                   key: key,
                                   value: subkey,
                                   x: ctrl.labels[key](subkey),
                                   y: values[subkey]
                                 };
                               })
                               .sortBy(function(record) {
                                 switch (key) {
                                   case 'structure_id':
                                   case 'profil_id':
                                   case 'url':
                                     return record.y * -1;
                                   default:
                                     return record.x;
                                 }
                               })
                               .value()
                           }]
                         ];
                       })
                       .object()
                       .value();

                     let count_unique_x_per_key = (logs, x, key) => {
                       return _.chain(logs)
                         .groupBy((line) => line[key])
                         .map((loglines, id) => {
                           return {
                             x: ctrl.labels[key](id),
                             y: _.chain(loglines).pluck(x).uniq().value().length
                           };
                         }).value()
                     };

                     ['structure_id', 'application_id', 'profil_id', 'weekday', 'hour'].forEach((key) => {
                       ctrl.stats[key].push({
                         key: 'utilisateurs uniques',
                         values: count_unique_x_per_key(ctrl.logs, 'user_id', key)
                       });
                     });

                     ['structure_id', 'profil_id'].forEach((key) => {
                       let nb_uniq_users = count_unique_x_per_key(ctrl.logs, 'user_id', key);
                       let nb_clicks = count_unique_x_per_key(ctrl.logs, 'id', key);

                       ctrl.stats[key].push({
                         key: 'nombre de clicks moyens par utilisateur unique',
                         values: _(nb_clicks).map((item) => {
                           item.y = item.y / _(nb_uniq_users).findWhere({x: item.x}).y;

                           return item;
                         })
                       });
                     });

                     // count apps used for each structure
                     ctrl.stats.structure_id.push({
                       key: 'apps',
                       values: count_unique_x_per_key(ctrl.logs, 'application_id', "structure_id")
                     });
                   };

                   ctrl.filter_data = (data) => {
                     return _(data)
                       .select((logline) => {
                         return (ctrl.structures_types.selected.length == 0 ||
                                 _.chain(ctrl.structures.list)
                                 .select((structure) => _.chain(ctrl.structures_types.selected).pluck("id").contains(structure.type).value())
                                 .pluck("id")
                                 .contains(logline.structure_id)
                                 .value()) &&

                           (ctrl.cities.selected.length == 0 ||
                            _.chain(ctrl.structures.list)
                            .select((structure) => _.chain(ctrl.cities.selected).pluck("zip_code").contains(structure.zip_code).value())
                            .pluck("id")
                            .contains(logline.structure_id)
                            .value()) &&

                           (ctrl.applications.selected.length == 0 || _.chain(ctrl.applications.selected).pluck("id").contains(logline.application_id).value()) &&

                           (ctrl.structures.selected.length == 0 || _.chain(ctrl.structures.selected).pluck("id").contains(logline.structure_id).value()) &&

                           (ctrl.profiles_types.selected.length == 0 || _.chain(ctrl.profiles_types.selected).pluck("id").contains(logline.profil_id).value());
                       });
                   };

                   ctrl.retrieve_data = function() {
                     ctrl.loading = true;
                     ctrl.raw_logs = [];

                     let extract_structures_ids_from_filters = () => {
                       let structures_ids = [];

                       if ( ctrl.structures.selected.length > 0 ) {
                         structures_ids = structures_ids.concat( ctrl.structures.selected.map((s) => s.id) );
                       }

                       if ( ctrl.cities.selected.length > 0 ) {
                         let cities = ctrl.cities.selected.map((c) => c.zip_code);

                         structures_ids = structures_ids.concat( ctrl.structures.list.filter((s) => cities.includes( s.zip_code )).map((s) => s.id) );
                       }

                       if ( structures_ids.length == 0 ) {
                         structures_ids = _(ctrl.user.profiles.map((profile) => profile.structure_id)).uniq();
                       }

                       return structures_ids;
                     };

                     $http.get(`${URL_ENT}/api/logs`, {
                       params: {
                         'timestamp>': ctrl.debut.clone().toDate(),
                         'timestamp<': ctrl.fin.clone().toDate(),
                         'structure_id[]': extract_structures_ids_from_filters()
                       }
                     })
                       .then(function(response) {
                         ctrl.raw_logs = response.data;
                         ctrl.process_data(ctrl.filter_data(ctrl.raw_logs));
                         ctrl.loading = false;
                       });
                   };

                   ctrl.download_json = function(data, name) {
                     var a = document.createElement('a');
                     a.href = `data:application/json;charset=utf-8,${JSON.stringify(data)}`;
                     a.setAttribute('download', `${name}.json`);
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                   };

                   $http.get(`${URL_ENT}/api/users/current`)
                     .then(function success(response) {
                       ctrl.user = response.data;

                       ctrl.allowed = _.chain(response.data.profiles)
                         .pluck('type')
                         .intersection(['DIR', 'ADM'])
                         .value().length > 0;

                       if (ctrl.allowed) {
                         let promises = [
                           $http.get(`${URL_ENT}/api/profiles_types`)
                             .then(function(response) {
                               ctrl.profiles_types.list = response.data;

                               ctrl.labels.profil_id = _.memoize((profile_type) => {
                                 let label = profile_type;
                                 let profile = _(ctrl.profiles_types.list).findWhere({ id: profile_type });
                                 if (profile != undefined) {
                                   label = profile.name;
                                 }

                                 return label;
                               });
                             }),

                           $http.get(`${URL_ENT}/api/applications`)
                             .then(function(response) {
                               ctrl.applications.list = response.data;

                               ctrl.labels.application_id = _.memoize((application_id) => {
                                 let label = application_id;
                                 let app = _(ctrl.applications.list).findWhere({ id: application_id });
                                 if (app != undefined) {
                                   label = app.name;
                                 }

                                 return label;
                               });
                             }),

                           $http.get(`${URL_ENT}/api/structures_types`)
                             .then((response) => {
                               ctrl.structures_types.list = response.data;
                             }),

                           $http.get(`${URL_ENT}/api/structures`, { params: { expand: false, "id[]": _.chain(ctrl.raw_logs).pluck("structure_id").uniq().value() } })
                             .then((response) => {
                               ctrl.structures.list = response.data;

                               ctrl.labels.structure_id = (uai) => {
                                 let label = '';
                                 let structure = _(ctrl.structures.list).findWhere({ id: uai });
                                 if (structure != undefined) {
                                   label = structure.name;
                                 }

                                 return `${label} (${uai})`;
                               };

                               ctrl.cities.list = _.chain(ctrl.structures.list).map((structure) => { return { zip_code: structure.zip_code, city: structure.city }; }).uniq((city) => city.zip_code).reject((city) => { return city.zip_code == null || city.zip_code == ""; }).value();
                             })
                             .then(() => {

                               ctrl.loading = false;
                             })
                         ];

                         $q.all(promises)
                           .then((responses) => {
                             ctrl.period.reset();
                           })
                       }
                     });
                 }
                ],
    template: `
    <div class="container" ng:if="$ctrl.allowed">
      <div class="col-md-12" style="text-align: center;">
        <div class="controls pull-right">
          <select ng:options="period_type.value as period_type.label for period_type in $ctrl.period_types.list"
                  ng:model="$ctrl.period_types.selected"
                  ng:change="$ctrl.period.reset()"></select>
          <button class="btn btn-warning" ng:click="$ctrl.period.reset()"> ✕ </button>
          <button class="btn btn-primary" ng:click="$ctrl.period.decr()"> ◀ </button>
          <button class="btn btn-primary" ng:click="$ctrl.period.incr()"> ▶ </button>
          <button class="btn btn-success" ng:click="$ctrl.retrieve_data()"> Valider </button>
        </div>
        <h2>
          {{ $ctrl.debut | amDateFormat:'Do MMMM YYYY' }} - {{ $ctrl.fin | amDateFormat:'Do MMMM YYYY' }}
        </h2>
      </div>
      <h1 style="text-align: center;" ng:if="$ctrl.raw_logs.length == 0 && !$ctrl.loading">
        <span class="label label-primary">Aucune donnée disponible pour la période donnée.</span>
      </h1>
      <div>
        <div class="col-md-12">

          <div class="col-md-3">
            <div class="panel panel-default">
              <div class="panel-heading">
                Communes <button class="btn btn-xs btn-warning pull-right" ng:click="$ctrl.cities.selected = []; $ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"> ✕ </button>
              </div>
              <div class="panel-body" style="padding: 0;">
                <select multiple style="width: 100%;"
                        ng:options="city as city.zip_code + ' : ' + city.city for city in $ctrl.cities.list | orderBy:'zip_code'"
                        ng:model="$ctrl.cities.selected"
                        ng:change="$ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"></select>
              </div>
            </div>
          </div>

          <div class="col-md-3">
            <div class="panel panel-default">
              <div class="panel-heading">
                Établissements <button class="btn btn-xs btn-warning pull-right" ng:click="$ctrl.structures.selected = []; $ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"> ✕ </button>
              </div>
              <div class="panel-body" style="padding: 0;">
                <select multiple style="width: 100%;"
                        ng:options="structure as structure.name for structure in $ctrl.structures.list | orderBy:'name'"
                        ng:model="$ctrl.structures.selected"
                        ng:change="$ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"></select>
              </div>
            </div>
          </div>

          <div class="col-md-2">
            <div class="panel panel-default">
              <div class="panel-heading">
                Structures <button class="btn btn-xs btn-warning pull-right" ng:click="$ctrl.structures_types.selected = []; $ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"> ✕ </button>
              </div>
              <div class="panel-body" style="padding: 0;">
                <select multiple style="width: 100%;"
                        ng:options="st as '' + st.name for st in $ctrl.structures_types.list | orderBy:'name'"
                        ng:model="$ctrl.structures_types.selected"
                        ng:change="$ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"></select>
              </div>
            </div>
          </div>

          <div class="col-md-2">
            <div class="panel panel-default">
              <div class="panel-heading">
                Profils <button class="btn btn-xs btn-warning pull-right" ng:click="$ctrl.profiles_types.selected = []; $ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"> ✕ </button>
              </div>
              <div class="panel-body" style="padding: 0;">
                <select multiple style="width: 100%;"
                        ng:options="pt as pt.name for pt in $ctrl.profiles_types.list | orderBy:'name'"
                        ng:model="$ctrl.profiles_types.selected"
                        ng:change="$ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"></select>
              </div>
            </div>
          </div>

          <div class="col-md-2">
            <div class="panel panel-default">
              <div class="panel-heading">
                Tuiles <button class="btn btn-xs btn-warning pull-right" ng:click="$ctrl.applications.selected = []; $ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"> ✕ </button>
              </div>
              <div class="panel-body" style="padding: 0;">
                <select multiple style="width: 100%;"
                        ng:options="app as app.name for app in $ctrl.applications.list | orderBy:'name'"
                        ng:model="$ctrl.applications.selected"
                        ng:change="$ctrl.process_data($ctrl.filter_data($ctrl.raw_logs));"></select>
              </div>
            </div>
          </div>

        </div>

        <h1 style="text-align: center;" ng:if="$ctrl.raw_logs.length == 0 && $ctrl.loading">
          <span class="label label-warning">Chargement et traitement des données en cours...</span>
          <loader-spinner></loader-spinner>
        </h1>

        <div class="col-md-12" ng:if="$ctrl.raw_logs.length > 0 && !$ctrl.loading">
          <em class="col-md-3 label label-default">{{$ctrl.totals.clicks}} clicks</em>
          <em class="col-md-3 label label-primary">{{$ctrl.totals.users}} utilisateurs uniques</em>
          <em class="col-md-3 label label-success">{{$ctrl.totals.connections}} connexions</em>
          <em class="col-md-3 label label-info">{{$ctrl.totals.active_connections}} connexions actives</em>
        </div>

        <uib-tabset>
          <uib-tab index="$index + 1"
                   ng:repeat="(key, stat) in $ctrl.stats">
            <uib-tab-heading>
              <em class="badge">{{stat[0].values.length}}</em> {{$ctrl.types_labels[key]}} <button class="btn btn-xs btn-primary" ng:click="$ctrl.download_json(stat, key)"><span class="glyphicon glyphicon-save"></span></button>
            </uib-tab-heading>
            <nvd3 data="stat"
                  options="$ctrl.chart_options( key, stat )">
            </nvd3>
          </uib-tab>
        </uib-tabset>
      </div>
    </div>
`
  });
