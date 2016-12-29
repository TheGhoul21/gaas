import Relay from 'react-relay';

export default class AddNewNodeMutation extends Relay.Mutation {
  static fragments = {
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
  };

  getMutation() {
    return Relay.QL`mutation{ _schema { addFieldToEntity } }`;
  }

  getFatQuery() {
    return Relay.QL`
      fragment on Entity {
        fields {
          type
          name
        }
        name
      }
    `;
  }

  getConfigs() {
    return [{
      type: 'RANGE_ADD',
      parentName: 'schema',
      parentID: this.props.viewer.id,
      connectionName: 'todos',
      edgeName: 'todoEdge',
      rangeBehaviors: ({ status }) => (
        status === 'completed' ? 'ignore' : 'append'
      ),
    }];
  }

  getVariables() {
    return {
      text: this.props.text,
    };
  }

  getOptimisticResponse() {
    const { viewer, text } = this.props;

    return {
      viewer: {
        id: viewer.id,
        numTodos: viewer.numTodos + 1,
      },

      // FIXME: numTodos gets updated optimistically, but this edge does not
      // get added until the server responds.
      todoEdge: {
        node: {
          complete: false,
          text,
        },
      },
    };
  }
}
