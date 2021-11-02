import { Db } from 'mongodb';
import { MongoInserter } from 'mongodb-extension';
import { ErrorHandler, Handler, RetryWriter } from 'mq-one';
import { Attributes, Validator } from 'validator-x';
import { ApplicationContext } from './context';
import { User } from './models/User';
import { Publisher } from './services/pubsub/publisher';
import { SimpleSubscriber } from './services/pubsub/subcriber';

const topicId = 'users';
const cre = {
  'type': 'service_account',
  'project_id': 'go-firestore-rest-api',
  'private_key_id': 'df1e6c245486c90c182edba78ecd0d4af7ecb994',
  'private_key': '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDXwGvPmHrOC9m1\n+w8i/849avMpy4xrOxWWfXn1YB/Kr4n38G94Xrqa3xBPsOtm6oYlwrheTL7MxdWH\nk4MzHPkNnSzpYOOBSDS1gKRA0Rz14UA76TCwGKuijdtj4Fr0d1SuHgX5tlBTPAj7\n2YV5/feOtZds8ME61NO0C5ep2LKygG0KQpdSfL9cLtUsfFYv+xmPeTSn3yu84maY\nmIWiXHRXUsVjmzkFIy3aaTOze9hvFg3qAlXP2DvAJgVR4PS2b47ADFvMVzo0gn0I\nbdfXK1wAFQg4PgbIk2Rdwe5BWnI34K34ZVTxHfHZASfyDhHWg5+dKxkhrJR/ISIT\nsTmvSL3TAgMBAAECggEAN2kIZ1MaaxO5ENdPTmZTUgvHMrs/r4SHqVRFf8L1t0j5\nDq/1+PyfQUo7trPR6WcfF9CYKEPeltnSWtUEU5rDzf7Je5CyLVBdlSXaSXlLTkzR\nAfIEWp2jawayy0ZiJboGCgfU8gqkO5RGHGSDts6Gh2TU5Jo6jkD9tBZsF6d7UYNY\nRu8BkVNueNT/j9Nem6hzx1aux5gchIiEwjYnteDsZZBhNEPzilETXGAuT5UcVB2j\njgtX66+2mp1X76cdo1hk31vzrYxpsV1TqgsDAJzDToT1keWSWslWwx3xOUwHPs8N\nYfyuj+H71qZZiraTWiaN4kLJThJBtkbUJCjbPf8D/QKBgQD6ifBLH0dDnYXb2wsB\nrsX9SdwIz6XUqSg/n0T74lf/ABX4znadUzzfxGlB2EGqQ529Oxn+M2iChP667YVK\nMbuoqws/+CvXgrr6OF2qS74hajBpE/fIYIqdKZD7JbZAd6czyNEeRPwmu3xA+SH4\nTtGxg8WrRbu5M404w87KKwuOnQKBgQDcdFzI3i4GsglbzYYCLrW1WCPKGJey22fR\ngA3XZPp7+t2TVN9gjGQbvEFKNGzOiUCy4Y6ZQVJH8ALolExBHdj0Hdvl3X3XMB//\n93vWlP1NhGPwjZsthqINSk94Vxlxv2YPriEXblHQdZ4lsCZ3KhTeK4QNeHoUqk1q\njjx4XusbLwKBgEVuSKto5aT1WI1PLMOwnanN+C5w7TH8Fu1axBFR7rT6Xxxuiyya\nTrpsggb/WWNIDcTNRizOLl5NYRKIlHG1Sp45mIqHyg6Vah/B0yNIjk5QUU4tfHOJ\nXaCkTktrbhB7mFifhGRxFbfeKVcQM7vOjAo3zGXkk1uFz9M1YG9icnd5AoGAHEXc\nJHLCKl+o7ZolJqCA81nzdRbEVc7nuKmYnNg5e68Hvb5zy3kV2azCHtcsYSyfHJHq\n7OLAv7MbXGKwiOVgDqbJrehDHFbys6w0uKdw+QESpCY1EZijrdqq6H8bJ0hpuXcW\njV+7pGWBO8oklMHT3U5taCDcX0wcE59cR/+8XUcCgYEAz7ly/vY82s+beEVcpbbZ\nIw1tmOCkzPywQcePrSX+rPGdShYeiwQmprbZWiKyTYREUKkr2xt23A0irSgG3KOW\nWOZ0uswzj5r7VEnQflbAXhQLONRBWGHZZYdJ1GEqVlhb0A4j3xsw7jnB1Ypwfmbl\niiPXdFzuEX2Q3on3AfThMgw=\n-----END PRIVATE KEY-----\n',
  'client_email': 'pubsub@go-firestore-rest-api.iam.gserviceaccount.com',
  'client_id': '112269970918400710901',
  'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
  'token_uri': 'https://oauth2.googleapis.com/token',
  'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
  'client_x509_cert_url': 'https://www.googleapis.com/robot/v1/metadata/x509/pubsub%40go-firestore-rest-api.iam.gserviceaccount.com'
};

const projectId = 'go-firestore-rest-api';
const subscriptionName = 'users-sub';

const user: Attributes = {
  id: {
    length: 40
  },
  username: {
    required: true,
    length: 255
  },
  email: {
    format: 'email',
    required: true,
    length: 120
  },
  phone: {
    format: 'phone',
    required: true,
    length: 14
  },
  dateOfBirth: {
    type: 'datetime'
  }
};

const retries = [5000, 10000, 20000];
export function createContext(db: Db): ApplicationContext {
  const writer = new MongoInserter(db.collection('users'), 'id');
  const retryWriter = new RetryWriter(writer.write, retries, writeUser, log);
  const publisher = new Publisher<User>(topicId, projectId, cre, log);
  // const retryService = new RetryService<User, string>(publisher.publish, log, log);
  const errorHandler = new ErrorHandler(log);
  const validator = new Validator<User>(user, true);
  const handlerPubSub = new Handler<User, string>(retryWriter.write, validator.validate, [], errorHandler.error, log, log, undefined, 3, 'retry');
  const subscriber = new SimpleSubscriber<User>(projectId, subscriptionName, cre);
  const ctx: ApplicationContext = { subscribe: subscriber.subscribe, handle: handlerPubSub.handle };
  return ctx;
}

export function log(msg: any): void {
  console.log(JSON.stringify(msg));
}
export function writeUser(msg: User): Promise<number> {
  console.log('Error: ' + JSON.stringify(msg));
  return Promise.resolve(1);
}