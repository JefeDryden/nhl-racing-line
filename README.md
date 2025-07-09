# NHL Racing Line Chart Animation

An animated line chart race visualization built with D3.js that displays the top 10 individuals with the highest values over time.

## Features

- Animated line chart race showing top 10 performers
- Smooth transitions between time periods
- Play/pause controls with adjustable animation speed
- Color-coded lines for each individual
- Dynamic axis scaling
- Responsive design

## Project Structure

```
nhl-racing-line/
├── index.html          # Main HTML file hosting the visualization
├── line-chart-race.js  # JavaScript implementation using D3.js
└── README.md          # Project documentation
```

## Data Structure

The chart expects data in the following format:

```javascript
const data = [
  {
    date: "2024-01-01",
    values: [
      { id: "unique_id", name: "Display Name", value: 100 },
      // ... more individuals
    ]
  },
  // ... more time periods
];
```

### Data Requirements

- **date**: String representing the time period
- **values**: Array of objects for all individuals at that time point
  - **id**: Unique identifier for consistent color mapping
  - **name**: Display name shown on the chart
  - **value**: Numeric value for that time period

## Usage

1. Open `index.html` in a modern web browser
2. The chart will load with sample NHL player data
3. Use the controls to:
   - **Play**: Start the animation
   - **Pause**: Stop the animation
   - **Reset**: Return to the beginning
   - **Speed slider**: Adjust animation speed (1-10)

## Customization

### Modifying the Number of Top Performers

Change the `top_n` property in the LineChartRace constructor:

```javascript
this.top_n = 10; // Change to desired number
```

### Adding Your Own Data

Replace the `sampleData` variable in `line-chart-race.js` with your own data following the structure above.

### Styling

Modify the CSS in `index.html` to customize:
- Colors and fonts
- Chart dimensions
- Control button styles
- Animation timing

## Implementation Details

### Key D3.js Features Used

- **Scales**: Linear scales for x-axis (values) and y-axis (ranks)
- **Transitions**: Smooth animations between time periods
- **Data Joins**: Enter/update/exit pattern for managing elements
- **Line Generator**: D3 line generator with monotone curve interpolation

### Performance Considerations

- Data is pre-sorted by value for each time period
- Only top N individuals are rendered at each frame
- Transitions use consistent timing for smooth playback
- Color mapping is pre-calculated for all individuals

## Browser Compatibility

This visualization requires a modern browser with support for:
- ES6 JavaScript features
- D3.js v7
- CSS3 transitions
- SVG rendering

## Future Enhancements

Consider implementing:
- CSV/JSON file upload capability
- Timeline scrubber for manual navigation
- Export functionality (PNG/SVG)
- Mobile-responsive controls
- Multiple statistics tracking
- Configurable axis labels and formatting

## License

This project is open source and available under the MIT License.