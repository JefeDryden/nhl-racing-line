class LineChartRace {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.rawData = data;
        this.currentIndex = 0;
        this.isPlaying = false;
        this.frameDelay = 50; // Milliseconds between frames
        this.top_n = 10;
        this.isDynamicScale = true;
        this.framesPerTransition = 30; // Number of interpolated frames between data points
        
        // Track player fade states
        this.playerFadeStates = new Map(); // playerId -> { state: 'fadingIn'|'visible'|'fadingOut', progress: 0-1 }
        
        // Interpolate data for smooth transitions
        this.data = this.interpolateData(data);
        
        // Track original data point indices for x-axis
        this.originalDataIndices = [];
        this.data.forEach((frame, i) => {
            if (!frame.interpolated) {
                this.originalDataIndices.push(i);
            }
        });
        
        this.margin = { top: 40, right: 150, bottom: 60, left: 80 };
        this.width = 1000 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        
        // Fixed x position for dots (center of chart)
        this.dotX = this.width / 2;
        
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        this.colorMap = new Map();
        
        this.init();
        this.setupControls();
    }
    
    init() {
        this.svg = this.container
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);
        
        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // X scale for historical data (past dates)
        this.xScale = d3.scaleLinear()
            .domain([-9, 0])  // Show last 10 time points (-9 to 0)
            .range([0, this.dotX]);
        
        // Scale for mapping original data indices to x positions
        this.dateScale = d3.scaleLinear()
            .range([0, this.dotX]);
        
        // Y scale for values (dynamic)
        this.yScale = d3.scaleLinear()
            .range([this.height, 0]);
        
        // Find closest original data index
        this.findClosestOriginalIndex = (frameIndex) => {
            let closest = 0;
            for (let i = 0; i < this.originalDataIndices.length; i++) {
                if (this.originalDataIndices[i] <= frameIndex) {
                    closest = i;
                } else {
                    break;
                }
            }
            return closest;
        };
        
        // Initialize with first frame's data
        this.updateYScale(0);
        
        // Create axes
        this.xAxis = d3.axisBottom(this.xScale)
            .tickFormat(d => '')  // Will be set dynamically in update()
        
        this.yAxis = d3.axisLeft(this.yScale)
            .tickFormat(d3.format('.0f'));
        
        // Create a clipping path for x-axis
        this.g.append('defs')
            .append('clipPath')
            .attr('id', 'x-axis-clip')
            .append('rect')
            .attr('x', 0)
            .attr('y', -10)
            .attr('width', this.dotX + 10)
            .attr('height', 30);
        
        this.xAxisG = this.g.append('g')
            .attr('class', 'x-axis axis')
            .attr('transform', `translate(0,${this.height})`)
            .attr('clip-path', 'url(#x-axis-clip)');
        
        // Inner group for translating axis content
        this.xAxisInner = this.xAxisG.append('g')
            .call(this.xAxis);
        
        this.yAxisG = this.g.append('g')
            .attr('class', 'y-axis axis')
            .call(this.yAxis);
        
        // Axis labels
        this.g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', `translate(${this.width/2},${this.height + 45})`)
            .style('text-anchor', 'middle')
            .text('Timeline');
        
        this.g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - this.margin.left)
            .attr('x', 0 - (this.height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text('Points');
        
        // Add current date line
        this.currentDateLine = this.g.append('line')
            .attr('class', 'current-date-line')
            .attr('x1', this.dotX)
            .attr('x2', this.dotX)
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', '#ff0000')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
        
        // Base line generator
        this.lineGenerator = d3.line()
            .y(d => this.yScale(d.value))
            .curve(d3.curveMonotoneX);
        
        this.setupColorMap();
        this.preparePlayerData();
        
        // Create groups for visual elements
        this.linesGroup = this.g.append('g').attr('class', 'lines');
        this.dotsGroup = this.g.append('g').attr('class', 'dots');
        this.leadersGroup = this.g.append('g').attr('class', 'leaders');
        this.labelsGroup = this.g.append('g').attr('class', 'labels');
        
        this.update(0);
    }
    
    interpolateData(data) {
        if (data.length < 2) return data;
        
        const interpolatedData = [];
        
        for (let i = 0; i < data.length - 1; i++) {
            const currentFrame = data[i];
            const nextFrame = data[i + 1];
            
            // Add the current frame
            interpolatedData.push(currentFrame);
            
            // Create interpolated frames
            for (let j = 1; j < this.framesPerTransition; j++) {
                const t = j / this.framesPerTransition;
                
                // Interpolate date
                const currentDate = new Date(currentFrame.date);
                const nextDate = new Date(nextFrame.date);
                const interpolatedDate = new Date(currentDate.getTime() + (nextDate.getTime() - currentDate.getTime()) * t);
                
                // Create a map of player values for easy lookup
                const currentMap = new Map(currentFrame.values.map(p => [p.id, p]));
                const nextMap = new Map(nextFrame.values.map(p => [p.id, p]));
                
                // Get all unique player IDs
                const allPlayerIds = new Set([...currentMap.keys(), ...nextMap.keys()]);
                
                // Interpolate values for each player
                const interpolatedValues = [];
                allPlayerIds.forEach(playerId => {
                    const currentPlayer = currentMap.get(playerId);
                    const nextPlayer = nextMap.get(playerId);
                    
                    if (currentPlayer && nextPlayer) {
                        // Player exists in both frames - interpolate
                        interpolatedValues.push({
                            id: playerId,
                            name: currentPlayer.name,
                            value: currentPlayer.value + (nextPlayer.value - currentPlayer.value) * t
                        });
                    } else if (currentPlayer && !nextPlayer) {
                        // Player only in current frame - keep current value
                        interpolatedValues.push({
                            id: playerId,
                            name: currentPlayer.name,
                            value: currentPlayer.value
                        });
                    } else if (!currentPlayer && nextPlayer) {
                        // Player only in next frame - use next value scaled by t
                        interpolatedValues.push({
                            id: playerId,
                            name: nextPlayer.name,
                            value: nextPlayer.value * t
                        });
                    }
                });
                
                interpolatedData.push({
                    date: interpolatedDate.toISOString().split('T')[0],
                    values: interpolatedValues,
                    interpolated: true
                });
            }
        }
        
        // Add the last frame
        interpolatedData.push(data[data.length - 1]);
        
        return interpolatedData;
    }
    
    setupColorMap() {
        const allIds = new Set();
        this.data.forEach(timePoint => {
            timePoint.values.forEach(d => allIds.add(d.id));
        });
        
        let colorIndex = 0;
        allIds.forEach(id => {
            this.colorMap.set(id, this.colorScale(colorIndex++));
        });
    }
    
    preparePlayerData() {
        // Create player data structure
        const playerMap = new Map();
        
        // Initialize players
        this.data.forEach(timePoint => {
            timePoint.values.forEach(player => {
                if (!playerMap.has(player.id)) {
                    playerMap.set(player.id, {
                        id: player.id,
                        name: player.name,
                        values: new Array(this.data.length).fill(null)
                    });
                }
            });
        });
        
        // Fill in values for each time point
        this.data.forEach((timePoint, timeIndex) => {
            timePoint.values.forEach(player => {
                const playerData = playerMap.get(player.id);
                playerData.values[timeIndex] = player.value;
            });
        });
        
        // Interpolate missing values
        playerMap.forEach(player => {
            for (let i = 0; i < this.data.length; i++) {
                if (player.values[i] === null) {
                    // Find previous and next non-null values
                    let prevIndex = i - 1;
                    let nextIndex = i + 1;
                    
                    while (prevIndex >= 0 && player.values[prevIndex] === null) prevIndex--;
                    while (nextIndex < this.data.length && player.values[nextIndex] === null) nextIndex++;
                    
                    if (prevIndex >= 0 && nextIndex < this.data.length) {
                        // Interpolate
                        const prevValue = player.values[prevIndex];
                        const nextValue = player.values[nextIndex];
                        const ratio = (i - prevIndex) / (nextIndex - prevIndex);
                        player.values[i] = prevValue + (nextValue - prevValue) * ratio;
                    } else if (prevIndex >= 0) {
                        // Use previous value
                        player.values[i] = player.values[prevIndex];
                    } else if (nextIndex < this.data.length) {
                        // Use next value
                        player.values[i] = player.values[nextIndex];
                    }
                }
            }
        });
        
        this.players = Array.from(playerMap.values());
    }
    
    getTopPlayers(timeIndex) {
        // Get players sorted by value for this time point
        const currentData = this.data[timeIndex];
        return currentData.values
            .sort((a, b) => b.value - a.value)
            .slice(0, this.top_n);
    }
    
    calculateLabelPositions(players) {
        // Sort players by y position
        const sortedPlayers = players.map(p => ({
            ...p,
            y: this.yScale(p.value),
            labelY: this.yScale(p.value)
        })).sort((a, b) => a.y - b.y);
        
        const labelHeight = 20; // Minimum space between labels
        const labelPadding = 5;
        
        // Adjust positions to avoid overlaps
        for (let i = 1; i < sortedPlayers.length; i++) {
            const prev = sortedPlayers[i - 1];
            const curr = sortedPlayers[i];
            
            const minY = prev.labelY + labelHeight;
            if (curr.labelY < minY) {
                curr.labelY = minY;
            }
        }
        
        // Check if labels go beyond chart bounds and compress if needed
        const lastLabel = sortedPlayers[sortedPlayers.length - 1];
        if (lastLabel && lastLabel.labelY > this.height - labelPadding) {
            const overflow = lastLabel.labelY - (this.height - labelPadding);
            const compression = overflow / sortedPlayers.length;
            
            sortedPlayers.forEach((player, i) => {
                player.labelY -= compression * (i + 1);
            });
        }
        
        // Create a map for quick lookup
        const positionMap = new Map();
        sortedPlayers.forEach(player => {
            positionMap.set(player.id, {
                y: player.y,
                labelY: player.labelY,
                needsLeader: Math.abs(player.labelY - player.y) > 2
            });
        });
        
        return positionMap;
    }
    
    getHistoricalData(playerId, currentIndex) {
        // Safety check for initialization
        if (!this.players) return [];
        
        const player = this.players.find(p => p.id === playerId);
        if (!player) return [];
        
        // Debug: track what values this player's line will actually show
        const debugValues = [];
        
        const currentOriginalIndex = this.findClosestOriginalIndex(currentIndex);
        
        // Get historical data preserving interpolated trail
        const histData = [];
        
        if (currentOriginalIndex < 9) {
            // For first 9 original data points, include all frames from beginning to current
            for (let i = 0; i <= currentIndex; i++) {
                if (player.values[i] !== undefined && player.values[i] !== null) {
                    histData.push({
                        value: player.values[i],
                        index: i,
                        originalIndex: i,
                        frameIndex: i,
                        fadeOpacity: 1
                    });
                    debugValues.push(player.values[i]);
                }
            }
        } else {
            // For sliding window mode (point 10+), calculate smooth window start
            const windowStartOrigIndex = currentOriginalIndex - 9;
            
            // Calculate interpolation progress for smooth sliding
            let interpolationProgress = 0;
            if (currentOriginalIndex < this.originalDataIndices.length - 1) {
                const currentOrigFrame = this.originalDataIndices[currentOriginalIndex];
                const nextOrigFrame = this.originalDataIndices[currentOriginalIndex + 1];
                
                if (nextOrigFrame - currentOrigFrame > 0) {
                    interpolationProgress = (currentIndex - currentOrigFrame) / (nextOrigFrame - currentOrigFrame);
                }
            }
            
            // Calculate smooth window start position
            const windowStartFrameIndex = this.originalDataIndices[windowStartOrigIndex];
            const nextWindowStartFrameIndex = windowStartOrigIndex + 1 < this.originalDataIndices.length 
                ? this.originalDataIndices[windowStartOrigIndex + 1] 
                : windowStartFrameIndex;
            
            // Smooth window start moves continuously with interpolation
            const smoothWindowStart = windowStartFrameIndex + (nextWindowStartFrameIndex - windowStartFrameIndex) * interpolationProgress;
            
            // Include frames from smooth window start to current index
            for (let i = Math.floor(smoothWindowStart); i <= currentIndex; i++) {
                if (player.values[i] !== undefined && player.values[i] !== null) {
                    // Calculate fade factor for frames going off the left edge
                    let fadeOpacity = 1;
                    if (i < smoothWindowStart) {
                        // Fade out frames that are sliding off the left edge
                        fadeOpacity = Math.max(0, 1 - (smoothWindowStart - i));
                    }
                    
                    histData.push({
                        value: player.values[i],
                        index: i,
                        originalIndex: i,
                        frameIndex: i,
                        fadeOpacity: fadeOpacity
                    });
                    debugValues.push(player.values[i]);
                }
            }
        }
        
        // Debug: show what values this line will actually display
        if (debugValues.length > 0) {
            const lineMin = Math.min(...debugValues);
            const lineMax = Math.max(...debugValues);
            console.log(`Line for ${player.name || playerId}: min=${lineMin}, max=${lineMax}, values=[${debugValues.join(', ')}]`);
        }
        
        return histData;
    }
    
    generateLinePath(histData, currentIndex) {
        const currentOriginalIndex = this.findClosestOriginalIndex(currentIndex);
        
        // Calculate interpolation progress for smooth movement
        let interpolationProgress = 0;
        if (currentOriginalIndex < this.originalDataIndices.length - 1) {
            const currentOrigFrame = this.originalDataIndices[currentOriginalIndex];
            const nextOrigFrame = this.originalDataIndices[currentOriginalIndex + 1];
            
            if (nextOrigFrame - currentOrigFrame > 0) {
                interpolationProgress = (currentIndex - currentOrigFrame) / (nextOrigFrame - currentOrigFrame);
            }
        }
        
        // Calculate current dot position with smooth interpolation
        let currentDotX;
        if (currentOriginalIndex < 9) {
            const dateInterval = this.dotX / 9;
            currentDotX = (currentOriginalIndex + interpolationProgress) * dateInterval;
        } else {
            currentDotX = this.dotX;
        }
        
        // Create line with proper x positioning
        const lineWithX = histData.map((d, i) => {
            let x;
            
            if (currentOriginalIndex < 9) {
                // For first 9 points: distribute evenly from start to current dot position
                if (i === histData.length - 1) {
                    x = currentDotX; // Last point connects to smoothly moving dot
                } else {
                    // Distribute intermediate points evenly
                    const totalPoints = histData.length - 1;
                    if (totalPoints === 0) {
                        x = currentDotX;
                    } else {
                        x = (i / totalPoints) * currentDotX;
                    }
                }
            } else {
                // For sliding window mode (point 10+): smooth sliding window
                const windowStartOrigIndex = currentOriginalIndex - 9;
                
                // Calculate interpolation progress for smooth sliding
                let interpolationProgress = 0;
                if (currentOriginalIndex < this.originalDataIndices.length - 1) {
                    const currentOrigFrame = this.originalDataIndices[currentOriginalIndex];
                    const nextOrigFrame = this.originalDataIndices[currentOriginalIndex + 1];
                    
                    if (nextOrigFrame - currentOrigFrame > 0) {
                        interpolationProgress = (currentIndex - currentOrigFrame) / (nextOrigFrame - currentOrigFrame);
                    }
                }
                
                // Calculate smooth window start position (same as in getHistoricalData)
                const windowStartFrameIndex = this.originalDataIndices[windowStartOrigIndex];
                const nextWindowStartFrameIndex = windowStartOrigIndex + 1 < this.originalDataIndices.length 
                    ? this.originalDataIndices[windowStartOrigIndex + 1] 
                    : windowStartFrameIndex;
                
                const smoothWindowStart = windowStartFrameIndex + (nextWindowStartFrameIndex - windowStartFrameIndex) * interpolationProgress;
                
                if (i === histData.length - 1) {
                    x = currentDotX; // Current dot position
                } else {
                    // Calculate relative position within the smoothly sliding window
                    const frameIndex = d.frameIndex;
                    const relativeFramePosition = frameIndex - smoothWindowStart;
                    const totalFramesInWindow = currentIndex - smoothWindowStart;
                    
                    // Map to x-scale range (0 to dotX)
                    if (totalFramesInWindow > 0) {
                        x = (relativeFramePosition / totalFramesInWindow) * currentDotX;
                    } else {
                        x = currentDotX;
                    }
                }
            }
            
            return { ...d, x: x };
        });
        
        // Generate line path - simplified approach for better performance
        const linePath = this.lineGenerator.x(d => d.x)(lineWithX);
        
        // Calculate base opacity for sliding window mode (separate from player fades)
        let baseSlidingOpacity = 1.0;
        if (currentOriginalIndex >= 9) {
            // Use minimum opacity from the line to create fade effect
            const minOpacity = Math.min(...lineWithX.map(d => d.fadeOpacity || 1));
            baseSlidingOpacity = Math.max(0.1, minOpacity);
        }
        
        return { path: linePath, baseSlidingOpacity: baseSlidingOpacity };
    }
    
    updateFadeStates(topPlayers) {
        const fadeSpeed = 0.1; // How much to increment/decrement opacity per frame
        const currentPlayerIds = new Set(topPlayers.map(p => p.id));
        
        // Update existing fade states
        for (let [playerId, fadeState] of this.playerFadeStates) {
            if (currentPlayerIds.has(playerId)) {
                // Player should be visible
                if (fadeState.state === 'fadingIn') {
                    fadeState.progress = Math.min(1, fadeState.progress + fadeSpeed);
                    if (fadeState.progress >= 1) {
                        fadeState.state = 'visible';
                    }
                } else if (fadeState.state === 'fadingOut') {
                    // Player came back before fully fading out
                    fadeState.state = 'fadingIn';
                } else {
                    // Already visible, nothing to do
                }
            } else {
                // Player should fade out
                if (fadeState.state === 'visible' || fadeState.state === 'fadingIn') {
                    fadeState.state = 'fadingOut';
                }
                if (fadeState.state === 'fadingOut') {
                    fadeState.progress = Math.max(0, fadeState.progress - fadeSpeed);
                    if (fadeState.progress <= 0) {
                        this.playerFadeStates.delete(playerId);
                    }
                }
            }
        }
        
        // Add new players
        for (let player of topPlayers) {
            if (!this.playerFadeStates.has(player.id)) {
                this.playerFadeStates.set(player.id, {
                    state: 'fadingIn',
                    progress: 0
                });
            }
        }
    }
    
    getPlayerOpacity(playerId, baseOpacity = 1) {
        const fadeState = this.playerFadeStates.get(playerId);
        if (!fadeState) return 0;
        return fadeState.progress * baseOpacity;
    }
    
    setupControls() {
        const playButton = d3.select('#play-button');
        const pauseButton = d3.select('#pause-button');
        const resetButton = d3.select('#reset-button');
        const speedSlider = d3.select('#speed-slider');
        const speedValue = d3.select('#speed-value');
        
        playButton.on('click', () => this.play());
        pauseButton.on('click', () => this.pause());
        resetButton.on('click', () => this.reset());
        
        speedSlider.on('input', function() {
            const value = this.value;
            speedValue.text(value);
            // Adjust frame delay: 1 = 100ms, 10 = 10ms
            this.frameDelay = 110 - (value * 10);
        }.bind(this));
    }
    
    play() {
        if (this.currentIndex >= this.data.length - 1) {
            this.reset();
        }
        
        this.isPlaying = true;
        d3.select('#play-button').property('disabled', true);
        d3.select('#pause-button').property('disabled', false);
        
        this.animate();
    }
    
    pause() {
        this.isPlaying = false;
        d3.select('#play-button').property('disabled', false);
        d3.select('#pause-button').property('disabled', true);
    }
    
    reset() {
        this.pause();
        this.currentIndex = 0;
        this.update(0);
    }
    
    animate() {
        if (!this.isPlaying || this.currentIndex >= this.data.length - 1) {
            this.pause();
            return;
        }
        
        this.currentIndex++;
        // Use shorter duration for smooth frame transitions
        this.update(this.frameDelay * 0.8);
        
        setTimeout(() => this.animate(), this.frameDelay);
    }
    
    updateYScale(timeIndex) {
        // Safety check for initialization
        if (!this.players) {
            this.yScale.domain([0, 100]);
            return;
        }
        
        if (!this.isDynamicScale) {
            // Use fixed scale based on all data
            const allValues = this.data.flatMap(d => d.values.map(v => v.value));
            const minValue = d3.min(allValues);
            const maxValue = d3.max(allValues);
            this.yScale.domain([Math.max(0, minValue * 0.95), maxValue * 1.05]);
        } else {
            // Dynamic scale based on visible historical trail
            const currentOriginalIndex = this.findClosestOriginalIndex(timeIndex);
            
            // Determine the range of original data indices that are visible
            let startOriginalIndex, endOriginalIndex;
            if (currentOriginalIndex < 9) {
                // For first 9 points, show from beginning to current
                startOriginalIndex = 0;
                endOriginalIndex = currentOriginalIndex;
            } else {
                // For sliding window, show last 10 original data points
                startOriginalIndex = currentOriginalIndex - 9;
                endOriginalIndex = currentOriginalIndex;
            }
            
            // Get all values that will be visible (including lines that are drawn)
            const visibleValues = [];
            const allRelevantPlayers = new Set();
            
            // First, get ALL players who are currently visible (including fading)
            const currentTopPlayers = this.getTopPlayers(timeIndex);
            currentTopPlayers.forEach(player => {
                allRelevantPlayers.add(player.id);
            });
            
            // Add all players that are currently fading (in or out)
            for (let [playerId, fadeState] of this.playerFadeStates) {
                allRelevantPlayers.add(playerId);
            }
            
            // Also look ahead to identify players who will be in the next top 10
            const nextOriginalIndex = currentOriginalIndex + 1;
            if (nextOriginalIndex < this.originalDataIndices.length) {
                const nextFrameIndex = this.originalDataIndices[nextOriginalIndex];
                if (nextFrameIndex < this.data.length) {
                    const nextFrameData = this.data[nextFrameIndex];
                    const nextTopPlayers = nextFrameData.values
                        .sort((a, b) => b.value - a.value)
                        .slice(0, this.top_n);
                    
                    nextTopPlayers.forEach(player => {
                        allRelevantPlayers.add(player.id);
                    });
                }
            }
            
            // Track values per player for debugging
            const playerValues = new Map();
            
            // Use the same logic as getHistoricalData to get the actual values that will be drawn
            for (let playerId of allRelevantPlayers) {
                const histData = this.getHistoricalData(playerId, timeIndex);
                histData.forEach(dataPoint => {
                    visibleValues.push(dataPoint.value);
                    
                    // Track for debugging
                    const playerName = this.players.find(p => p.id === playerId)?.name || playerId;
                    if (!playerValues.has(playerName)) {
                        playerValues.set(playerName, []);
                    }
                    playerValues.get(playerName).push(dataPoint.value);
                });
            }
            
            // Also include values from the next frame for all relevant players
            if (nextOriginalIndex < this.originalDataIndices.length) {
                const nextFrameIndex = this.originalDataIndices[nextOriginalIndex];
                if (nextFrameIndex < this.data.length) {
                    const nextFrameData = this.data[nextFrameIndex];
                    
                    for (let playerId of allRelevantPlayers) {
                        const playerData = nextFrameData.values.find(p => p.id === playerId);
                        if (playerData) {
                            visibleValues.push(playerData.value);
                            
                            // Track for debugging
                            if (!playerValues.has(playerData.name)) {
                                playerValues.set(playerData.name, []);
                            }
                            playerValues.get(playerData.name).push(playerData.value);
                        }
                    }
                }
            }
            
            const minValue = d3.min(visibleValues) || 0;
            const maxValue = d3.max(visibleValues) || 100;
            
            // Check if any visible lines would go below the current scale
            const actualMinOnScreen = Math.min(...visibleValues);
            const actualMaxOnScreen = Math.max(...visibleValues);
            
            console.log(`Frame ${timeIndex}: Actual min/max on screen: ${actualMinOnScreen} to ${actualMaxOnScreen}`);
            
            // Don't apply the 0.9 multiplier - use the actual minimum or 0, whichever is higher
            const yMin = Math.max(0, actualMinOnScreen);
            const yMax = actualMaxOnScreen * 1.1;
            
            console.log(`Y-axis domain: [${yMin}, ${yMax}]`);
            
            this.yScale.domain([yMin, yMax]);
        }
    }
    
    update(duration = 0) {
        const currentData = this.data[this.currentIndex];
        
        // Update y-scale
        this.updateYScale(this.currentIndex);
        
        // Update y-axis
        this.yAxisG
            .transition()
            .duration(duration)
            .call(this.yAxis);
        
        // Update date display - format nicely
        const dateObj = new Date(currentData.date);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        d3.select('#date-display').text(dateObj.toLocaleDateString('en-US', options));
        
        // Update x-axis with smooth scrolling using transform
        const currentOriginalIndex = this.findClosestOriginalIndex(this.currentIndex);
        
        // Calculate interpolation progress between data points
        let interpolationProgress = 0;
        if (currentOriginalIndex < this.originalDataIndices.length - 1) {
            const currentOrigFrame = this.originalDataIndices[currentOriginalIndex];
            const nextOrigFrame = this.originalDataIndices[currentOriginalIndex + 1];
            
            if (nextOrigFrame - currentOrigFrame > 0) {
                interpolationProgress = (this.currentIndex - currentOrigFrame) / (nextOrigFrame - currentOrigFrame);
            }
        }
        
        // Calculate the width of one date interval
        const dateInterval = this.dotX / 9;
        
        // Calculate which dates should be visible in the window
        let windowStart, windowEnd;
        if (currentOriginalIndex < 9) {
            // For first 10 points, show from 0 to current
            windowStart = 0;
            windowEnd = 9;
        } else {
            // For rest, show sliding window of 10 points
            windowStart = currentOriginalIndex - 9;
            windowEnd = currentOriginalIndex;
        }
        
        // Calculate translation to keep current date at the red line
        let totalTranslation = 0;
        if (currentOriginalIndex > 9) {
            // Only start translating after we have 10 points
            totalTranslation = -(currentOriginalIndex - 9 + interpolationProgress) * dateInterval;
        }
        
        // Create axis with extended range for smooth scrolling
        const extendedStart = 0;
        const extendedEnd = Math.min(this.originalDataIndices.length - 1, currentOriginalIndex + 2);
        
        // Generate tick values for all dates up to current + buffer
        const tickValues = [];
        for (let i = extendedStart; i <= extendedEnd; i++) {
            tickValues.push(i);
        }
        
        // Create a fixed scale for positioning all ticks
        const tickScale = d3.scaleLinear()
            .domain([0, this.originalDataIndices.length - 1])
            .range([0, (this.originalDataIndices.length - 1) * dateInterval]);
        
        // Update axis with all ticks
        this.xAxis
            .scale(tickScale)
            .tickValues(tickValues)
            .tickFormat(i => {
                if (i >= 0 && i < this.originalDataIndices.length) {
                    const frameIndex = this.originalDataIndices[i];
                    const frame = this.data[frameIndex];
                    const date = new Date(frame.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
                return '';
            });
        
        // Apply smooth translation
        this.xAxisInner
            .transition()
            .duration(duration)
            .ease(d3.easeLinear)
            .attr('transform', `translate(${totalTranslation},0)`)
            .call(this.xAxis);
        
        // Get top 10 players for current time point
        const topPlayers = this.getTopPlayers(this.currentIndex);
        
        // Update fade states
        this.updateFadeStates(topPlayers);
        
        // Get all players that need to be rendered (including fading out ones)
        const allPlayersToRender = [...topPlayers];
        for (let [playerId, fadeState] of this.playerFadeStates) {
            if (fadeState.state === 'fadingOut' && !topPlayers.find(p => p.id === playerId)) {
                // Find this player in the current data
                const playerData = this.data[this.currentIndex].values.find(p => p.id === playerId);
                if (playerData) {
                    allPlayersToRender.push(playerData);
                }
            }
        }
        
        // Calculate label positions to avoid overlaps - use all players for positioning
        const labelPositions = this.calculateLabelPositions(allPlayersToRender);
        
        // Update historical lines
        const lines = this.linesGroup.selectAll('.player-line')
            .data(allPlayersToRender, d => d.id);
        
        // Pre-calculate line data for better performance
        const lineData = new Map();
        allPlayersToRender.forEach(player => {
            const histData = this.getHistoricalData(player.id, this.currentIndex);
            const lineResult = this.generateLinePath(histData, this.currentIndex);
            lineData.set(player.id, lineResult);
        });
        
        lines.enter()
            .append('path')
            .attr('class', 'player-line')
            .attr('fill', 'none')
            .attr('stroke', d => this.colorMap.get(d.id))
            .attr('stroke-width', 2)
            .attr('d', d => lineData.get(d.id).path)
            .attr('opacity', d => this.getPlayerOpacity(d.id, lineData.get(d.id).baseSlidingOpacity * 0.7));
        
        // Update path with transition
        lines
            .transition()
            .duration(duration)
            .attr('d', d => lineData.get(d.id).path);
        
        // Update opacity without transition on the current data selection only
        lines.attr('opacity', d => this.getPlayerOpacity(d.id, lineData.get(d.id).baseSlidingOpacity * 0.7));
        
        lines.exit().remove();
        
        
        // Calculate dot x position with fine interpolation between tick marks
        let dotXPosition;
        
        if (currentOriginalIndex < 9) {
            // For first 9 points, dots move across the x-axis with smooth interpolation
            const dateInterval = this.dotX / 9;
            
            // Calculate interpolation progress for smooth movement
            let interpolationProgress = 0;
            if (currentOriginalIndex < this.originalDataIndices.length - 1) {
                const currentOrigFrame = this.originalDataIndices[currentOriginalIndex];
                const nextOrigFrame = this.originalDataIndices[currentOriginalIndex + 1];
                
                if (nextOrigFrame - currentOrigFrame > 0) {
                    interpolationProgress = (this.currentIndex - currentOrigFrame) / (nextOrigFrame - currentOrigFrame);
                }
            }
            
            // Position dot with smooth movement
            dotXPosition = (currentOriginalIndex + interpolationProgress) * dateInterval;
        } else {
            // After 9th point, dots stay at the red line
            dotXPosition = this.dotX;
        }
        
        // Update dots at calculated x position
        const dots = this.dotsGroup.selectAll('.dot')
            .data(allPlayersToRender, d => d.id);
        
        dots.enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('r', 6)
            .attr('fill', d => this.colorMap.get(d.id))
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('cx', dotXPosition)
            .attr('cy', d => this.yScale(d.value))
            .attr('opacity', d => this.getPlayerOpacity(d.id, 1));
        
        dots
            .transition()
            .duration(duration)
            .attr('cx', dotXPosition)
            .attr('cy', d => this.yScale(d.value))
            .attr('opacity', d => this.getPlayerOpacity(d.id, 1));
        
        dots.exit().remove();
        
        // Update leader lines - include fading out players that need leaders
        const playersNeedingLeaders = allPlayersToRender.filter(d => {
            const pos = labelPositions.get(d.id);
            return pos && pos.needsLeader;
        });
        
        const leaders = this.leadersGroup.selectAll('.leader-line')
            .data(playersNeedingLeaders, d => d.id);
        
        leaders.enter()
            .append('line')
            .attr('class', 'leader-line')
            .attr('stroke', d => this.colorMap.get(d.id))
            .attr('stroke-width', 1)
            .attr('x1', dotXPosition + 8)
            .attr('y1', d => labelPositions.get(d.id).y)
            .attr('x2', dotXPosition + 12)
            .attr('y2', d => labelPositions.get(d.id).labelY)
            .attr('opacity', d => this.getPlayerOpacity(d.id, 0.3));
        
        leaders
            .transition()
            .duration(duration)
            .attr('x1', dotXPosition + 8)
            .attr('x2', dotXPosition + 12)
            .attr('y1', d => labelPositions.get(d.id).y)
            .attr('y2', d => labelPositions.get(d.id).labelY)
            .attr('opacity', d => this.getPlayerOpacity(d.id, 0.3));
        
        leaders.exit().remove();
        
        // Update labels
        const labels = this.labelsGroup.selectAll('.label')
            .data(allPlayersToRender, d => d.id);
        
        labels.enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', dotXPosition + 15)
            .attr('y', d => labelPositions.get(d.id) ? labelPositions.get(d.id).labelY : this.yScale(d.value))
            .attr('dy', '0.35em')
            .style('fill', d => this.colorMap.get(d.id))
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(d => `${d.name}: ${d.value.toFixed(0)}`)
            .style('opacity', d => this.getPlayerOpacity(d.id, 1));
        
        labels
            .transition()
            .duration(duration)
            .attr('x', dotXPosition + 15)
            .attr('y', d => labelPositions.get(d.id) ? labelPositions.get(d.id).labelY : this.yScale(d.value))
            .text(d => `${d.name}: ${d.value.toFixed(0)}`)
            .style('opacity', d => this.getPlayerOpacity(d.id, 1));
        
        labels.exit().remove();
    }
}

function aggregateToWeekly(dailyData) {
    // Group data by week
    const weeklyData = [];
    const weekGroups = new Map();
    
    dailyData.forEach(dayData => {
        const date = new Date(dayData.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Set to Sunday
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weekGroups.has(weekKey)) {
            weekGroups.set(weekKey, []);
        }
        weekGroups.get(weekKey).push(dayData);
    });
    
    // For each week, take the last day's data
    weekGroups.forEach((weekDays, weekStart) => {
        const lastDay = weekDays[weekDays.length - 1];
        weeklyData.push({
            date: weekStart,
            values: lastDay.values
        });
    });
    
    return weeklyData;
}

async function loadAndTransformData(viewType = 'daily') {
    try {
        const response = await fetch('all_data.json');
        const rawData = await response.json();
        
        // Sort dates chronologically
        const sortedDates = Object.keys(rawData).sort((a, b) => new Date(a) - new Date(b));
        
        // Transform data to the expected format
        const transformedData = sortedDates.map(date => {
            const players = rawData[date];
            
            // Map player data to the expected format
            const values = players.map((player, index) => ({
                id: `player_${player.playerId}`,
                name: player.skaterFullName,
                value: player.points
            }));
            
            return {
                date: date,
                values: values
            };
        });
        
        // Aggregate to weekly if needed
        if (viewType === 'weekly') {
            return aggregateToWeekly(transformedData);
        }
        
        return transformedData;
    } catch (error) {
        console.error('Error loading data:', error);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    let chart = null;
    let currentView = 'daily';
    
    async function initChart(viewType) {
        const data = await loadAndTransformData(viewType);
        if (data.length > 0) {
            // Clear existing chart
            d3.select('#chart').selectAll('*').remove();
            chart = new LineChartRace('#chart', data);
        } else {
            console.error('No data loaded');
        }
    }
    
    // Initialize with daily view
    await initChart('daily');
    
    // Handle view toggle
    d3.select('#view-toggle').on('change', async function() {
        currentView = this.value;
        await initChart(currentView);
    });
});