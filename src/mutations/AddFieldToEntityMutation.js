import Relay from 'react-relay';
// RIFARE TUTTO
export default class AddFieldToEntityMutation extends Relay.Mutation {
  static fragments = {
    schema: () => Relay.QL`
    fragment on Entity {
      name,
      fields {
        name,
        type
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
      type: 'FIELDS_CHANGE',
      // Correlate the `updatedDocument` field in the response
      // with the DataID of the record we would like updated.
      fieldIDs: {updatedDocument: this.props.document.id},
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
