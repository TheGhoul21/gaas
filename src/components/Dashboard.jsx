import React from 'react';
import Relay from 'react-relay';
import { Table, Dropdown, Container, Header, Segment, Modal, Button, Form, Input } from 'semantic-ui-react';
import {decodeId, encodeId } from '../../utils.js';
const url = 'http://58162dacf3c6823a39a4c04d.gaas.localhost:3001/graphql';
import queries from '../config/fragments.js';
import PropTypes from 'prop-types';

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
      addPopupShow: false,
    })
  }

  getOptions() {
    return Object.keys(queries).map((el) => el.replace(/Type$/, '')).map(el => ({text:el, value:el}))
  }

  handleChange(e, { value }) {
    this.props.router.push('/dashboard/' + value);
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
    console.log(this.props.schema.entity.fields.edges);

    const { multiple, options, isFetching, search, value, entityName } = this.state
    var addButton = <Button>{ "Add " + entityName }</Button>;
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
            <Modal trigger={ addButton }>
              <Modal.Header>
                Select a Photo
              </Modal.Header>
              <Modal.Content>
                <Modal.Description>
                  <Header>
                    Add a new entity
                  </Header>
                  <div>
                    <Form>
                    {this.props.schema.entity.fields.edges.map((field, index) =>
                      field.node.type != 'ID' ? (<Form.Field key={ "key" + field.node.name }>
                        <label>{ field.node.name + " [" + field.node.type + "]" + (field.node.inputRequired ? " * " : "") }</label>
                        {field.node.isEntityType ?
                          <Dropdown
                            placeholder='State'
                            search
                            selection
                            options={ [ { key: 'AL', value: 'AL', text: 'Alabama' }  ]} />
                          :
                          <Input required={field.node.inputRequired} placeholder={ field.node.name } />
                        }
                      </Form.Field> ): null
                    )}
                  </Form>
                </div>
                </Modal.Description>
              </Modal.Content>
            </Modal>
          </Segment>

        </Header>
        <Segment basic>
          <Table basic padded celled definition>
            <Table.Header>
              <Table.Row>
                {this.props.schema.entity.fields.edges.map((field, index) =>
                  <Table.HeaderCell key={ "key" + field.node.name }>
                    { field.node.name + " [" + field.node.type + "]" }
                  </Table.HeaderCell>
                )}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {( nodes.map((el) => {return (
                <Table.Row key={ el.node.id }>
                  {this.props.schema.entity.fields.edges.map((fieldEdge) =>
                    <Table.Cell key={ el.node.id + fieldEdge.node.name}>
                      { el.node[fieldEdge.node.name] ? (el.node[fieldEdge.node.name].__dataID__ ?
                        <a href={"#/dashboard/" + (decodeId(el.node[fieldEdge.node.name].__dataID__).entityName) + '/' + el.node[fieldEdge.node.name].__dataID__}>entity</a>
                        :
                        el.node[fieldEdge.node.name]):
                        <i>null</i>
                      }
                    </Table.Cell>
                  )}
                </Table.Row>
              )}))}
            </Table.Body>
          </Table>
        </Segment>
      </div>
    );
  }
}

Dashboard.propTypes = {
  collectionName: PropTypes.string
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
    entityName: "Post",
    first:5,

  },
  fragments: {
    //node: () => Relay.QL``,
    schema: () => Relay.QL`fragment on Schema {
      entity(name:$entityName) {
        fields(first: $first) {
          edges {
            node {
              name
              type
              isEntityType
              inputRequired
            }
          }
          pageInfo {hasNextPage}
        }
      }
    }`,
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
    //




    node: () => Relay.QL`
    fragment on Node {
      id
      ${Object.keys(queries).map(key => queries[key])}
    }
    `,
    // // schema: () => Relay.QL `
    // // fragment on Query {
    // //   entity(name: $entityName) {
    // //     fields {
    // //       name
    // //       type
    // //     }
    // //   }
    // // }
    // // `
    // schema: () => Relay.QL `
    // fragment on _schema {
    //   entity(name: $entityName, first: $first) {
    //     fields {
    //       edges {
    //         node{
    //           name
    //           type
    //         }
    //       }
    //     }
    //   }
    // }
    // `
  }
});
