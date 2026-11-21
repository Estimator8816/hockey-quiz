import { render } from 'preact';
import { App } from './app';
import { APP_NAME } from './config';
import './ui/styles.css';

document.title = APP_NAME;
render(<App />, document.getElementById('app')!);
