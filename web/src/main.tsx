import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { render } from "preact";
import { App } from "./App";
import "./tokens.css";
import "./styles.css";
import "./runs/runs.css";
import "./experiment/experiment.css";

render(<App />, document.getElementById("app")!);
