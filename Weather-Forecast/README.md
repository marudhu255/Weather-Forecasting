# Weather Forecasting Using LSTM

A standalone browser application for weather temperature forecasting using TensorFlow.js and Chart.js.

## Project structure

- `index.html` - main application page
- `css/style.css` - application styles
- `js/app.js` - CSV processing, preprocessing, LSTM training, evaluation, forecasting, and chart logic
- `dataset/sample_weather.csv` - sample CSV for testing
- `assets/images/` - optional images/icons

## Run

Open `index.html` in a modern browser such as Chrome or Edge.

## CSV format

The application automatically detects common column names. A typical dataset can contain:

`Date, Temperature, Humidity, Pressure, Wind Speed`

At least 25 valid temperature observations are required; a larger historical dataset is recommended for meaningful LSTM training.
