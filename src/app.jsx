import { applyRouterMiddleware } from 'react-router';
import { Router, Route, Link, IndexRoute } from 'react-router';


import Relay from 'react-relay';
import {browserHistory} from 'react-router';

import useRelay from 'react-router-relay';
import React from 'react';
import ReactDOM from 'react-dom';

import createHashHistory from 'history/lib/createHashHistory';
import useRouterHistory from 'react-router/lib/useRouterHistory';
// import Dashboard from './components/Dashboard.jsx';
import App from './components/App.jsx';
/* ... */

const url = 'http://58162dacf3c6823a39a4c04d.gaas.localhost:3001' + '/graphql';

import { initTemplateStringTransformer } from 'relay-runtime-query'
const history = useRouterHistory(createHashHistory)({ });

import {getTypes} from './config/fragments.js';
import fetch from 'isomorphic-fetch';
import {introspectionQuery, printSchema} from 'graphql/utilities';

function graphQLFetcher(graphQLParams) {
  const url = 'http://58162dacf3c6823a39a4c04d.gaas.localhost:3001' + '/graphql';
  return fetch(url, {
    method: 'post',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify(graphQLParams),
  }).then(response => response.json());
}
console.log(url);
graphQLFetcher({ query: introspectionQuery }).then(result => {
  const schemaJson = result.data;
  Relay.QL = initTemplateStringTransformer(schemaJson);

  getTypes(schemaJson);

  var Dashboard = require('./components/Dashboard.jsx').default;
  const url = 'http://58162dacf3c6823a39a4c04d.gaas.localhost:3001/graphql';
  Relay.injectNetworkLayer(
    new Relay.DefaultNetworkLayer(url, {
      credentials: 'same-origin'
    })
  );


  const NodesQuery = {
    viewer: () => Relay.QL`query { Viewer }`,
    schema: () => Relay.QL`query { Schema }`,
  };
  const NodeQuery = {
    node: () => Relay.QL`query { Node(id:$objectId) }`,
    schema: () => Relay.QL`query { Schema }`,
  };

  let AppRouter =
    <Router
      history={history}
      render={applyRouterMiddleware(useRelay)}
      environment={Relay.Store}
      >
      <Route
        path="/"
        >
        <Route path="dashboard">
          <IndexRoute
               component={Dashboard}
               queries={NodesQuery}
             />
          <Route
            path=":entityName"
            >
            <IndexRoute
              queries={NodesQuery}
              nodes={[]}
              component={Dashboard}
              prepareParams={params => (Object.assign(params, {first: 5}))}
              render={({ props }) => props ? <Dashboard history={history} first={5} after={""} node={null} {...props} /> : <h1>Loading...</h1>}
              />
            <Route
              path=":objectId"
              queries={NodeQuery}
              nodes={[]}
              component={Dashboard}
              render={({ props }) => props ? <Dashboard history={history} {...props} /> : <h1>Loading...</h1>}
              / >
            </Route>
          /*render={({ props }) => props ?
          <Widget {...props} />
          :
          <Loading />
        }*/
      </Route>

    </Route>
  </Router>
;

if(!process.env.___SERVER___) {
  ReactDOM.render(AppRouter, document.getElementById('react-root'));
}
// export default AppRouter;


/*<Route path="dashboard">
<IndexRoute
component={WidgetList}
queries={ViewerQueries}
prepareParams={prepareWidgetListParams}
/>
<Route
path=":entityName"
component={Widget}
queries={WidgetQueries}
render={({ props }) => props ? <Widget {...props} /> : <Loading />}
/>
</Route>*/
});
