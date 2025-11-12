import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_CLIENT_ID,
};

export const userPool = new CognitoUserPool(poolData);

export function signUpUser(email, password, phoneNumber, onSuccess, onFailure) {

const attributes = [
  new CognitoUserAttribute({ Name: "email", Value: email }),
  new CognitoUserAttribute({ Name: "phone_number", Value: phoneNumber })
];


  userPool.signUp(email, password, attributes, null, (err, result) => {
    if (err) onFailure(err);
    else onSuccess(result.user);
  });
}

export function confirmUser(email, code, onSuccess, onFailure) {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  user.confirmRegistration(code, true, (err, result) => {
    if (err) onFailure(err);
    else onSuccess(result);
  });
}

export function loginUser(email, password, onSuccess, onFailure) {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  const auth = new AuthenticationDetails({ Username: email, Password: password });

  user.authenticateUser(auth, {
    onSuccess: (result) => onSuccess(result.getIdToken().getJwtToken()),
    onFailure: (err) => onFailure(err),
  });
}

export function logoutUser() {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}
