import React from 'react';

import { Button, Segment, Container, Item, Icon, Menu, Popup, Divider } from 'semantic-ui-react';

import Relay, {
  DefaultNetworkLayer,
  RootContainer,
} from 'react-relay';

Relay.injectNetworkLayer(
  new DefaultNetworkLayer('http://localhost:3001')
);


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {active: props.active};
    this.handleLoginClick = this.handleLoginClick.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);
  }
  handleLoginClick() {
    this.setState({
      active: 'Luca'
    });
  }

  handleMenuClick(link) {
    var self = this;
    return function(event) {
      event.preventDefault();
      self.setState({active: link});
    }
  }
  render() {
    return (
      <div className="pusher">
        <Segment inverted vertical={true} textAlign="center">
          <Container>

            <Menu className="large" secondary={true} pointing={true} inverted={true}>
            <Menu.Item as="a" className="toc">
                <Icon name="sidebar" />
            </Menu.Item>
            <Menu.Item active={this.state.active == '/' || !this.state.active} onClick={this.handleMenuClick('/')} href="/">Home</Menu.Item>
            <Menu.Item active={this.state.active == '/work'} onClick={this.handleMenuClick('/work')} href="/work">Work</Menu.Item>
            <Menu.Item active={this.state.active == '/company'} onClick={this.handleMenuClick('/company')} href="/company">Company</Menu.Item>
            <Menu.Item active={this.state.active == '/careers'} onClick={this.handleMenuClick('/careers')} href="/jobs">Careers</Menu.Item>
            <Menu.Item className="right"onClick={this.handleLoginClick}>
                <Popup
                  trigger={<Button inverted={true}>Sign up</Button>}
                  on="click"
                  content={<Segment basic={true}><Button primary fluid>Login</Button>
                      <Divider horizontal>Or</Divider>
                      <Button secondary fluid>Sign Up Now</Button>
                    </Segment>}
                  />
            </Menu.Item>
          </Menu>
          </Container>
        </Segment>
      </div>
    );
  }
}

App.propTypes = {
  name: React.PropTypes.string
};

export default App;


// export default class App extends Component {
//   render(): void {
//     return (
//       <RootContainer
//         Component={Dashboard}
//         route={new TodoAppRoute({status: 'any'})}
//       />
//     );
//   }
// }
