class LineChartRace {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.data = data;
        this.currentIndex = 0;
        this.isPlaying = false;
        this.animationSpeed = 500;
        this.top_n = 10;
        
        this.margin = { top: 40, right: 150, bottom: 60, left: 80 };
        this.width = 1000 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        
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
        
        this.xScale = d3.scaleLinear()
            .range([0, this.width]);
        
        this.yScale = d3.scaleLinear()
            .domain([0, this.top_n - 1])
            .range([0, this.height]);
        
        this.xAxis = d3.axisBottom(this.xScale)
            .tickFormat(d3.format('.2s'));
        
        this.xAxisG = this.g.append('g')
            .attr('class', 'x-axis axis')
            .attr('transform', `translate(0,${this.height})`);
        
        this.g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', `translate(${this.width/2},${this.height + 40})`)
            .style('text-anchor', 'middle')
            .text('Value');
        
        this.lineGenerator = d3.line()
            .x(d => this.xScale(d.value))
            .y(d => this.yScale(d.rank))
            .curve(d3.curveMonotoneX);
        
        this.setupColorMap();
        this.update(0);
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
            this.animationSpeed = 1100 - (value * 100);
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
        this.update(this.animationSpeed);
        
        setTimeout(() => this.animate(), this.animationSpeed);
    }
    
    update(duration = 0) {
        const currentData = this.data[this.currentIndex];
        const date = currentData.date;
        
        d3.select('#date-display').text(date);
        
        const sortedData = [...currentData.values]
            .sort((a, b) => b.value - a.value)
            .slice(0, this.top_n)
            .map((d, i) => ({ ...d, rank: i }));
        
        const maxValue = d3.max(sortedData, d => d.value) || 1;
        this.xScale.domain([0, maxValue * 1.1]);
        
        this.xAxisG
            .transition()
            .duration(duration)
            .call(this.xAxis);
        
        const lines = this.g.selectAll('.line-group')
            .data(sortedData, d => d.id);
        
        const linesEnter = lines.enter()
            .append('g')
            .attr('class', 'line-group');
        
        linesEnter.append('path')
            .attr('class', 'line')
            .attr('stroke', d => this.colorMap.get(d.id))
            .attr('d', d => this.lineGenerator([{ value: 0, rank: d.rank }, { value: 0, rank: d.rank }]));
        
        linesEnter.append('circle')
            .attr('class', 'dot')
            .attr('r', 6)
            .attr('fill', d => this.colorMap.get(d.id))
            .attr('cx', 0)
            .attr('cy', d => this.yScale(d.rank));
        
        linesEnter.append('text')
            .attr('class', 'label')
            .attr('x', 5)
            .attr('y', d => this.yScale(d.rank))
            .attr('dy', '0.35em')
            .style('fill', d => this.colorMap.get(d.id))
            .text(d => d.name);
        
        const linesUpdate = linesEnter.merge(lines);
        
        linesUpdate.select('.line')
            .transition()
            .duration(duration)
            .attr('d', d => this.lineGenerator([{ value: 0, rank: d.rank }, { value: d.value, rank: d.rank }]));
        
        linesUpdate.select('.dot')
            .transition()
            .duration(duration)
            .attr('cx', d => this.xScale(d.value))
            .attr('cy', d => this.yScale(d.rank));
        
        linesUpdate.select('.label')
            .transition()
            .duration(duration)
            .attr('x', d => this.xScale(d.value) + 10)
            .attr('y', d => this.yScale(d.rank))
            .text(d => `${d.name}: ${d.value.toFixed(0)}`);
        
        lines.exit()
            .transition()
            .duration(duration)
            .style('opacity', 0)
            .remove();
    }
}

const sampleData = [
    {
        date: "2024-01-01",
        values: [
            { id: "player1", name: "Connor McDavid", value: 50 },
            { id: "player2", name: "Auston Matthews", value: 48 },
            { id: "player3", name: "Nathan MacKinnon", value: 45 },
            { id: "player4", name: "Nikita Kucherov", value: 44 },
            { id: "player5", name: "David Pastrnak", value: 42 },
            { id: "player6", name: "Leon Draisaitl", value: 40 },
            { id: "player7", name: "Mikko Rantanen", value: 38 },
            { id: "player8", name: "Matthew Tkachuk", value: 36 },
            { id: "player9", name: "Kirill Kaprizov", value: 35 },
            { id: "player10", name: "Jason Robertson", value: 34 },
            { id: "player11", name: "Elias Pettersson", value: 32 },
            { id: "player12", name: "Jack Hughes", value: 30 }
        ]
    },
    {
        date: "2024-01-08",
        values: [
            { id: "player1", name: "Connor McDavid", value: 55 },
            { id: "player2", name: "Auston Matthews", value: 52 },
            { id: "player3", name: "Nathan MacKinnon", value: 49 },
            { id: "player4", name: "Nikita Kucherov", value: 48 },
            { id: "player5", name: "David Pastrnak", value: 45 },
            { id: "player6", name: "Leon Draisaitl", value: 44 },
            { id: "player7", name: "Mikko Rantanen", value: 42 },
            { id: "player8", name: "Matthew Tkachuk", value: 40 },
            { id: "player9", name: "Kirill Kaprizov", value: 39 },
            { id: "player10", name: "Jason Robertson", value: 37 },
            { id: "player11", name: "Elias Pettersson", value: 36 },
            { id: "player12", name: "Jack Hughes", value: 34 }
        ]
    },
    {
        date: "2024-01-15",
        values: [
            { id: "player1", name: "Connor McDavid", value: 62 },
            { id: "player2", name: "Auston Matthews", value: 58 },
            { id: "player4", name: "Nikita Kucherov", value: 56 },
            { id: "player3", name: "Nathan MacKinnon", value: 54 },
            { id: "player5", name: "David Pastrnak", value: 50 },
            { id: "player6", name: "Leon Draisaitl", value: 48 },
            { id: "player7", name: "Mikko Rantanen", value: 46 },
            { id: "player8", name: "Matthew Tkachuk", value: 44 },
            { id: "player9", name: "Kirill Kaprizov", value: 43 },
            { id: "player11", name: "Elias Pettersson", value: 42 },
            { id: "player10", name: "Jason Robertson", value: 40 },
            { id: "player12", name: "Jack Hughes", value: 38 }
        ]
    },
    {
        date: "2024-01-22",
        values: [
            { id: "player1", name: "Connor McDavid", value: 70 },
            { id: "player4", name: "Nikita Kucherov", value: 65 },
            { id: "player2", name: "Auston Matthews", value: 63 },
            { id: "player3", name: "Nathan MacKinnon", value: 60 },
            { id: "player5", name: "David Pastrnak", value: 56 },
            { id: "player6", name: "Leon Draisaitl", value: 54 },
            { id: "player7", name: "Mikko Rantanen", value: 52 },
            { id: "player11", name: "Elias Pettersson", value: 49 },
            { id: "player8", name: "Matthew Tkachuk", value: 48 },
            { id: "player9", name: "Kirill Kaprizov", value: 47 },
            { id: "player12", name: "Jack Hughes", value: 45 },
            { id: "player10", name: "Jason Robertson", value: 43 }
        ]
    },
    {
        date: "2024-01-29",
        values: [
            { id: "player1", name: "Connor McDavid", value: 78 },
            { id: "player4", name: "Nikita Kucherov", value: 74 },
            { id: "player2", name: "Auston Matthews", value: 70 },
            { id: "player3", name: "Nathan MacKinnon", value: 68 },
            { id: "player5", name: "David Pastrnak", value: 62 },
            { id: "player6", name: "Leon Draisaitl", value: 60 },
            { id: "player7", name: "Mikko Rantanen", value: 58 },
            { id: "player11", name: "Elias Pettersson", value: 56 },
            { id: "player12", name: "Jack Hughes", value: 53 },
            { id: "player8", name: "Matthew Tkachuk", value: 52 },
            { id: "player9", name: "Kirill Kaprizov", value: 51 },
            { id: "player10", name: "Jason Robertson", value: 48 }
        ]
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const chart = new LineChartRace('#chart', sampleData);
});