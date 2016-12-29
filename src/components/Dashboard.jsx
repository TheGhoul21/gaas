import React from 'react';
import Relay from 'react-relay';
import { Table, Dropdown, Container, Header, Segment } from 'semantic-ui-react';
import {decodeId, encodeId } from '../../utils.js';
const url = 'http://58162dacf3c6823a39a4c04d.gaas.dev:3001/graphql';
import queries from '../config/fragments.js';

// Relay.injectNetworkLayer(
//   new Relay.DefaultNetworkLayer(url)
// );
class Dashboard extends React.Component {
  constructor(props) {
    super(props);

    // this.state = {
    //   columns: [],
    //   collectionName: props.collectionName,
    //   collection
    // };
    this.handleChange = this.handleChange.bind(this);
    this.handleSearchChange = this.handleSearchChange.bind(this);
  }

  componentWillMount() {
    this.setState({
      isFetching: false,
      multiple: false,
      search: true,
      searchQuery: null,
      value: this.props.entityName,
      options: this.getOptions(),
    })
  }

  getOptions() {
    return Object.keys(queries).map((el) => el.replace(/Type$/, '')).map(el => ({text:el, value:el}))
  }

  handleChange(e, { value }) {
    this.props.history.push('/dashboard/' + value);
    return this.setState({ value, entityName: value  })
  }
  handleSearchChange(e, value) {
    this.setState({ searchQuery: value })
  }
  componentWillReceiveProps({schema, nodes, node}) {
    console.log(schema);
    console.log(nodes);
    console.log(node);
  }

  // fetchOptions = () => {
  //   this.setState({ isFetching: true })
  //
  //   setTimeout(() => {
  //     this.setState({ isFetching: false, options: getOptions() })
  //     this.selectRandom()
  //   }, 500)
  // }
  render() {
    let keys = [];
    let nodes = [];
    console.log(this.props);

    if(this.props.viewer && this.props.viewer.nodes) {
      nodes = this.props.viewer.nodes.edges;
    } else if(this.props.node) {
      let { node } = this.props;
      nodes = [{node}];
    }
    // if(nodes && nodes.length > 0 ) {
    //   keys = Object.keys(nodes[0].node);
    //   keys.splice(keys.indexOf("__dataID__"), 1);
    // }
    console.log(nodes);

    const { multiple, options, isFetching, search, value } = this.state

    return(
      <div>
        <Header inverted>
        <Segment inverted basic>
       <Dropdown
            selection
            multiple={multiple}
            search={search}
            options={options}
            value={value}
            placeholder={this.props.entityName}
            onChange={this.handleChange}
            onSearchChange={this.handleSearchChange}
            disabled={isFetching}
            loading={isFetching}
          />
      </Segment>
    </Header>
    <Segment basic>
      <Table basic padded celled definition>
        <Table.Header>
          <Table.Row>
            {this.props.schema.entity.fields.map((field, index) => <Table.HeaderCell key={ "key" + field.name }>{ field.name + " [" + field.type + "]" }</Table.HeaderCell>)}
        </Table.Row>
        </Table.Header>
        <Table.Body>
          {( nodes.map((el) => {return (
            <Table.Row key={ el.node.id }>
              {this.props.schema.entity.fields.map(({name}) => <Table.Cell key={ el.node.id + name}>
                { el.node[name] ? (el.node[name].__dataID__ ? <a href={"#/dashboard/" + (decodeId(el.node[name].__dataID__).entityName) + '/' + el.node[name].__dataID__}>entity</a> :
                el.node[name]): <i>null</i> }</Table.Cell>)}
            </Table.Row>)}))}
        </Table.Body>
      </Table>
    </Segment>
    </div>
    );
  }
}

Dashboard.propTypes = {
  collectionName: React.PropTypes.string
};
// fragments = '';
for(var i in queries) {
  queries[i] = Relay.QL([queries[i]]);
}

let nodeConnection = Relay.QL`
fragment on NodeConnection {
  edges {
    node {
      id
      ${queries['PostType']}
      ${queries['UserType']}
      ${queries['PostLikesType']}
    }
    cursor
  }
}
`;


export default Relay.createContainer(Dashboard, {
  initialVariables: {
    entityName: null,
    first:5,

  },
  fragments: {
    viewer: () => Relay.QL`
    fragment on Viewer {
      nodes(entityName: $entityName, first: $first) {
        edges {
          node {
            id
            ${Object.keys(queries).map(key => queries[key])}
          }
        }
      }
    }
    `,
    node: () => Relay.QL`
    fragment on Node {
      id
      ${queries['PostType']}
      ${queries['UserType']}
      ${queries['PostLikesType']}
    }
    `,
    schema: () => Relay.QL `
    fragment on Query {
      entity(name: $entityName) {
        fields {
          name
          type
        }
      }
    }
    `
  }
});
