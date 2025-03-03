/*

Generate the appropriate fragment for the current form, then
wrap the main Form component with the necessary HoCs while passing 
them the fragment. 

This component is itself wrapped with:

- withCurrentUser
- withApollo (used to access the Apollo client for form pre-population)

And wraps the Form component with:

- withNew

Or: 

- withSingle
- withUpdate
- withDelete

(When wrapping with withSingle, withUpdate, and withDelete, a special Loader
component is also added to wait for withSingle's loading prop to be false)

*/

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { intlShape } from 'meteor/vulcan:i18n';
import { withRouter } from 'react-router';
import { withApollo } from '@apollo/react-hoc';
import compose from 'recompose/compose';
import {
  Components,
  registerComponent,
  withCurrentUser,
  Utils,
  withCreate2,
  withUpdate2,
  withDelete2,
  getFragment,
} from 'meteor/vulcan:core';
import gql from 'graphql-tag';
import { withSingle } from 'meteor/vulcan:core';

import withCollectionProps from './withCollectionProps';
import { callbackProps } from './propTypes';

import getFormFragments from '../modules/formFragments';

class FormWrapper extends PureComponent {
  constructor(props) {
    super(props);
    // instantiate the wrapped component in constructor, not in render
    // see https://reactjs.org/docs/higher-order-components.html#dont-use-hocs-inside-the-render-method
    this.FormComponent = this.getComponent(props);
  }
  // return the current schema based on either the schema or collection prop
  getSchema() {
    return this.props.schema ? this.props.schema : this.props.collection.simpleSchema()._schema;
  }

  // if a document is being passed, this is an edit form
  getFormType() {
    return this.props.documentId || this.props.slug ? 'edit' : 'new';
  }

  // get fragment used to decide what data to load from the server to populate the form,
  // as well as what data to ask for as return value for the mutation
  getFragments() {
    const { fields, addFields, typeName, collectionName } = this.props;
    // autogenerated fragments
    let { queryFragment, mutationFragment } = getFormFragments({
      formType: this.getFormType(),
      collectionName,
      typeName,
      schema: this.getSchema(),
      fields,
      addFields,
    });


    // if queryFragment or mutationFragment props are specified, accept either fragment object or fragment string
    if (this.props.queryFragment) {
      queryFragment =
        typeof this.props.queryFragment === 'string'
          ? gql`
              ${this.props.queryFragment}
            `
          : this.props.queryFragment;
    }
    if (this.props.mutationFragment) {
      mutationFragment =
        typeof this.props.mutationFragment === 'string'
          ? gql`
              ${this.props.mutationFragment}
            `
          : this.props.mutationFragment;
    }

    // same with queryFragmentName and mutationFragmentName
    if (this.props.queryFragmentName) {
      queryFragment = getFragment(this.props.queryFragmentName);
    }
    if (this.props.mutationFragmentName) {
      mutationFragment = getFragment(this.props.mutationFragmentName);
    }

    // get query & mutation fragments from props or else default to same as generatedFragment
    return {
      queryFragment,
      mutationFragment,
    };
  }

  getComponent() {
    let WrappedComponent;

    const prefix = `${this.props.collectionName}${Utils.capitalize(this.getFormType())}`;

    const { queryFragment, mutationFragment } = this.getFragments();

    // props to pass on to child component (i.e. <Form />)
    const childProps = {
      formType: this.getFormType(),
      schema: this.getSchema(),
    };

    // options for withSingle HoC
    const queryOptions = {
      queryName: `${prefix}FormQuery`,
      collection: this.props.collection,
      fragment: queryFragment,
      queryOptions: {
        fetchPolicy: 'network-only', // we always want to load a fresh copy of the document
        pollInterval: 0, // no polling, only load data once
      },
      enableCache: false,
    };

    // options for withNew, withUpdate, and withDelete HoCs
    const mutationOptions = {
      collection: this.props.collection,
      fragment: mutationFragment,
    };

    // create a stateless loader component,
    // displays the loading state if needed, and passes on loading and document/data
    const Loader = props => {
      const { document, loading } = props;
      return loading ? (
        <Components.Loading />
      ) : (
          <Components.Form document={document} loading={loading} {...childProps} {...props} />
        );
    };
    Loader.displayName = 'withLoader(Form)';

    // if this is an edit from, load the necessary data using the withSingle HoC
    if (this.getFormType() === 'edit') {
      WrappedComponent = compose(
        withSingle(queryOptions),
        withUpdate2(mutationOptions),
        withDelete2(mutationOptions)
      )(Loader);

      return (
        <WrappedComponent
          selector={{
            documentId: this.props.documentId,
            slug: this.props.slug,
          }}
        />
      );
    } else {

      WrappedComponent = compose(withCreate2(mutationOptions))(Components.Form);

      return <WrappedComponent {...childProps} />;
    }
  }

  render() {
    const component = this.FormComponent;
    const componentWithParentProps = React.cloneElement(component, this.props);
    return componentWithParentProps;
  }
}

FormWrapper.propTypes = {
  // main options
  collection: PropTypes.object.isRequired,
  collectionName: PropTypes.string.isRequired,
  typeName: PropTypes.string.isRequired,

  documentId: PropTypes.string, // if a document is passed, this will be an edit form
  schema: PropTypes.object, // usually not needed
  queryFragment: PropTypes.object,
  queryFragmentName: PropTypes.string,
  mutationFragment: PropTypes.object,
  mutationFragmentName: PropTypes.string,

  // graphQL
  // createFoo, deleteFoo, updateFoo
  // newMutation: PropTypes.func, // the new mutation
  // editMutation: PropTypes.func, // the edit mutation
  // removeMutation: PropTypes.func, // the remove mutation

  // form
  prefilledProps: PropTypes.object,
  layout: PropTypes.string,
  fields: PropTypes.arrayOf(PropTypes.string),
  hideFields: PropTypes.arrayOf(PropTypes.string),
  addFields: PropTypes.arrayOf(PropTypes.string),
  showRemove: PropTypes.bool,
  submitLabel: PropTypes.node,
  cancelLabel: PropTypes.node,
  revertLabel: PropTypes.node,
  repeatErrors: PropTypes.bool,
  warnUnsavedChanges: PropTypes.bool,
  formComponents: PropTypes.object,
  disabled: PropTypes.bool,
  itemProperties: PropTypes.object,
  successComponent: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  contextName: PropTypes.string,

  // callbacks
  ...callbackProps,

  currentUser: PropTypes.object,
  client: PropTypes.object,
};

FormWrapper.defaultProps = {
  layout: 'horizontal',
};

FormWrapper.contextTypes = {
  closeCallback: PropTypes.func,
  intl: intlShape,
};

registerComponent({
  name: 'SmartForm',
  component: FormWrapper,
  hocs: [withCurrentUser, withApollo, withRouter, withCollectionProps],
});

export default FormWrapper;
