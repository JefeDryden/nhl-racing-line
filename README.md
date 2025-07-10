# NHL Racing Line Chart

An interactive visualization showing NHL player points progression over time with smooth racing line animations. Unlike traditional racing bar charts, this displays continuous line trails showing each player's complete scoring history.

## Features

### Core Visualization
- **Racing Line Animation**: Watch NHL players' points accumulate over time with smooth line trails
- **Top 10 Display**: Shows the top 10 players at any given time with dynamic ranking
- **Smooth Interpolation**: 30 frames of interpolation between data points for fluid animation
- **Historical Trails**: Each player shows their complete scoring history as a continuous line

### Interactive Controls
- **Play/Pause/Reset**: Standard playback controls for the animation
- **Speed Control**: Adjustable animation speed (1x to 10x)
- **View Toggle**: Switch between daily and weekly data aggregation

### Advanced Features
- **Sliding Window**: After 9 data points, the visualization switches to a sliding window mode
- **Smooth Fade Transitions**: Players fade in/out when entering/leaving the top 10
- **Label Collision Detection**: Smart positioning prevents overlapping player names
- **Dynamic Y-Axis Scaling**: Automatically adjusts scale based on visible data range
- **Leader Lines**: Connects dots to labels when collision avoidance moves them

## Data Format

The project expects NHL player data in `all_data.json` with the following structure:

```json
{
  "2025-10-15": [
    {
      "playerId": 8476453,
      "skaterFullName": "Nikita Kucherov",
      "points": 121,
      "goals": 37,
      "assists": 84,
      "gamesPlayed": 77,
      "pointsPerGame": 1.57142,
      "positionCode": "R"
    }
  ]
}
```

### Data Requirements
- **Date keys**: ISO date format (YYYY-MM-DD)
- **Player arrays**: Each date contains an array of player objects
- **Sorting**: Players should be pre-sorted by total points (highest first)
- **Time range**: Data spans from October to April (full NHL season)

## Project Structure

```
nhl-racing-line/
├── index.html                          # Main HTML page with controls and styling
├── line-chart-race.js                  # Core visualization class and logic
├── all_data.json                       # NHL player data (user-provided)
├── README.md                          # This documentation
└── feature_implementation_summary.txt  # Development history
```

## Usage

### Basic Setup
1. Place `all_data.json` in the project root
2. Open `index.html` in a web browser
3. Use the controls to start/pause the animation

### Controls
- **Play**: Start the animation from current position
- **Pause**: Stop the animation
- **Reset**: Return to the beginning
- **Speed Slider**: Adjust animation speed (1-10x)
- **View Toggle**: Switch between daily and weekly data

## Technical Implementation

### Architecture
- **Vanilla JavaScript** with D3.js for DOM manipulation and animations
- **Class-based structure**: `LineChartRace` class handles all visualization logic
- **Modular design**: Separate methods for data processing, animation, and rendering

### Key Components

#### Data Processing
```javascript
// Transform raw JSON data into visualization format
loadAndTransformData(viewType = 'daily')

// Aggregate daily data into weekly points
aggregateToWeekly(dailyData)

// Create smooth interpolation between data points
interpolateData(data)
```

#### Animation System
```javascript
// Main animation loop with configurable frame delay
animate()

// Update visual elements for each frame
update(duration)

// Handle smooth transitions between data points
generateLinePath(histData, currentIndex)
```

#### Visual Elements
- **Lines**: Historical scoring trails with smooth curves
- **Dots**: Current player positions with team colors
- **Labels**: Player names and current point totals
- **Axes**: Dynamic scaling with smooth scrolling

### Performance Optimizations
- **Pre-calculated line data**: Avoids redundant calculations during animation
- **Efficient DOM updates**: Minimizes redraws and reflows
- **Fade state management**: Independent opacity system prevents transition conflicts
- **Clipping paths**: Optimized rendering for sliding window mode

## Customization

### Animation Settings
```javascript
this.frameDelay = 50;              // Milliseconds between frames
this.framesPerTransition = 30;     // Interpolation frames between data points
this.top_n = 10;                   // Number of players to display
```

### Visual Appearance
```javascript
this.colorScale = d3.scaleOrdinal(d3.schemeCategory10); // Color scheme
const fadeSpeed = 0.1;             // Fade transition speed
```

### Scaling Behavior
```javascript
this.isDynamicScale = true;        // Enable dynamic y-axis scaling
const yMin = Math.max(0, minValue * 0.9);  // Y-axis minimum calculation
const yMax = maxValue * 1.1;       // Y-axis maximum with 10% buffer
```

## Browser Compatibility

- **Modern browsers** with ES6+ support
- **D3.js v7** (loaded via CDN)
- **Responsive design** works on desktop and tablet screens

## Development History

This project evolved through multiple feature requests:

1. **Data Integration**: Connected real NHL data from `all_data.json`
2. **Weekly Aggregation**: Added daily/weekly data toggle
3. **Dynamic Scaling**: Responsive Y-axis based on visible data
4. **Collision Detection**: Smart label positioning with leader lines
5. **Smooth Interpolation**: 30-frame transitions between data points
6. **Sliding Window**: Continuous scrolling after 9 data points
7. **Fade Transitions**: Smooth player enter/exit animations
8. **Performance Optimization**: Eliminated CSS/transition conflicts

## Known Issues

- Occasional visual glitches where player values may briefly appear incorrect
- Y-axis scaling edge cases with rapidly changing player rankings
- Performance may degrade with very large datasets or slow devices

## Future Enhancements

- **Team filtering**: Show/hide players by NHL team
- **Stat selection**: Toggle between points, goals, assists, plus/minus
- **Export functionality**: Save animations as video/GIF
- **Mobile optimization**: Touch controls and responsive scaling
- **Real-time data**: Live updates during NHL season
- **Timeline scrubber**: Manual navigation through the season

## Contributing

When adding new features:
1. Test with both daily and weekly data modes
2. Ensure fade transitions work correctly for entering/exiting players
3. Verify sliding window behavior after the 10th data point
4. Check y-axis scaling with edge cases
5. Update this README with new functionality

## License

This project is for educational and demonstration purposes. NHL data is property of the National Hockey League.