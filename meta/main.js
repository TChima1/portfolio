let xScaleGlobal, yScaleGlobal; 
let brushSelection = null;        

let data = [];
let commits = [];

// New variables for time filtering
let commitProgress = 100;
let filteredCommits = [];
let timeScale = d3.scaleTime([d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)], [0, 175]);
let commitMaxTime = timeScale.invert(commitProgress);
let lines = filteredCommits.flatMap((d) => d.lines);
let files = [];
files = d3
  .groups(lines, (d) => d.file)
  .map(([name, lines]) => {
    return { name, lines };
  });
let NUM_ITEMS = 100; // Will be set to commits length
let ITEM_HEIGHT = 60; // Increased to accommodate narrative
let VISIBLE_COUNT = 10;
let totalHeight;
let scrollContainer;
let spacer;
let itemsContainer;
const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 20 };
// Add these with the other global variables at the top of main.js
let FILES_NUM_ITEMS = 100;
let FILES_ITEM_HEIGHT = 60;
let FILES_VISIBLE_COUNT = 10;
let filesSpacer, filesScrollContainer, filesItemsContainer;

function updateTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
    const time = document.getElementById('commit-time');
    const author = document.getElementById('commit-author');
    const lines = document.getElementById('commit-lines');
    const tooltip = document.getElementById('commit-tooltip');

    if (Object.keys(commit).length === 0) {
        link.href = '';
        link.textContent = '';
        date.textContent = '';
        time.textContent = '';
        author.textContent = '';
        lines.textContent = '';
        tooltip.hidden = true;
        return;
    }

    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
        dateStyle: 'full'
    });
    time.textContent = commit.time;
    author.textContent = commit.author;
    lines.textContent = commit.totalLines;
    
    tooltip.hidden = false;
}

function processCommits() {
    commits = d3
        .groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;
            let ret = {
                id: commit,
                url: 'https://github.com/TChima1/portfolio/commit/' + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };

            Object.defineProperty(ret, 'lines', {
                value: lines,
                enumerable: false,
                configurable: true,
                writable: true
            });

            return ret;
        });
    
    // Initialize timeScale after commits are processed
    timeScale = d3.scaleTime(
        [d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)], 
        [0,705]
    );
    
    // Initially set filteredCommits to all commits
    filteredCommits = commits;
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 10}px`; 
    tooltip.style.top = `${event.clientY + 10}px`;
}

function filterCommitsByTime() {
    const commitMaxTime = timeScale.invert(commitProgress);
    filteredCommits = commits.filter(commit => commit.datetime <= commitMaxTime);
}



function createScatterplot() {
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    xScaleGlobal = d3.scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    yScaleGlobal = d3.scaleLinear()
        .domain([0, 24])
        .range([usableArea.bottom, usableArea.top]);

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt()
        .domain([minLines, maxLines])
        .range([2, 30]);

    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

    const svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    const gridlines = svg.append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

    gridlines.call(
        d3.axisLeft(yScaleGlobal)
            .tickFormat('')
            .tickSize(-usableArea.width)
    );

    const dots = svg.append('g')
        .attr('class', 'dots');

    svg.call(d3.brush()
        .on('start brush end', brushed));

    dots.selectAll('circle')
        .data(sortedCommits)
        .join('circle')
        .attr('cx', (d) => xScaleGlobal(d.datetime))
        .attr('cy', (d) => yScaleGlobal(d.hourFrac))
        .attr('r', (d) => rScale(d.totalLines))
        .attr('fill', d => {
            const hour = d.hourFrac;
            return hour >= 6 && hour < 18 
                ? 'oklch(70% 0.2 80)'  
                : 'oklch(70% 0.2 250)' 
        })
        .style('fill-opacity', 0.7)
        .on('mouseenter', function(event, commit) {
            d3.select(this).style('fill-opacity', 1);
            updateTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', function() {
            d3.select(this).style('fill-opacity', 0.7);
            updateTooltipContent({});
            updateTooltipVisibility(false);
        });

    svg.append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(d3.axisBottom(xScaleGlobal));

    svg.append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScaleGlobal)
            .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'));

    d3.select(svg.node()).selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterplot(filteredCommits) {
    // Clear existing SVG
    d3.select('#chart svg').remove();

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    xScaleGlobal = d3.scaleTime()
        .domain(d3.extent(filteredCommits, (d) => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    yScaleGlobal = d3.scaleLinear()
        .domain([0, 24])
        .range([usableArea.bottom, usableArea.top]);

    const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt()
        .domain([minLines, maxLines])
        .range([2, 30]);

    const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);

    const svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    const gridlines = svg.append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

    gridlines.call(
        d3.axisLeft(yScaleGlobal)
            .tickFormat('')
            .tickSize(-usableArea.width)
    );

    const dots = svg.append('g')
        .attr('class', 'dots');

    svg.call(d3.brush()
        .on('start brush end', brushed));

    dots.selectAll('circle')
        .data(sortedCommits)
        .join('circle')
        .attr('cx', (d) => xScaleGlobal(d.datetime))
        .attr('cy', (d) => yScaleGlobal(d.hourFrac))
        .attr('r', (d) => rScale(d.totalLines))
        .attr('fill', d => {
            const hour = d.hourFrac;
            return hour >= 6 && hour < 18 
                ? 'oklch(70% 0.2 80)'  
                : 'oklch(70% 0.2 250)' 
        })
        .style('fill-opacity', 0.7)
        .on('mouseenter', function(event, commit) {
            d3.select(this).style('fill-opacity', 1);
            updateTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', function() {
            d3.select(this).style('fill-opacity', 0.7);
            updateTooltipContent({});
            updateTooltipVisibility(false);
        });

    svg.append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(d3.axisBottom(xScaleGlobal));

    svg.append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScaleGlobal)
            .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'));

    d3.select(svg.node()).selectAll('.dots, .overlay ~ *').raise();
}

function displayStats() {
    processCommits();

    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    // Add total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);

    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);

    const numFiles = d3.group(data, d => d.file).size;
    dl.append('dt').text('Number of files');
    dl.append('dd').text(numFiles);

    const avgLineLength = d3.mean(data, d => d.length);
    dl.append('dt').text('Average line length');
    dl.append('dd').text(avgLineLength ? avgLineLength.toFixed(1) : 'N/A');
}

function updateStats(filteredCommits) {
    // Clear existing stats
    d3.select('#stats dl').remove();

    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    // Add total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(filteredCommits.reduce((sum, commit) => sum + commit.totalLines, 0));

    dl.append('dt').text('Total commits');
    dl.append('dd').text(filteredCommits.length);

    const numFiles = new Set(filteredCommits.flatMap(commit => commit.lines.map(line => line.file))).size;
    dl.append('dt').text('Number of files');
    dl.append('dd').text(numFiles);

    const avgLineLength = d3.mean(filteredCommits.flatMap(commit => commit.lines), d => d.length);
    dl.append('dt').text('Average line length');
    dl.append('dd').text(avgLineLength ? avgLineLength.toFixed(1) : 'N/A');
    updateFileVisualization();
}

function isCommitSelected(commit) {
    if (!brushSelection) return false;
    
    const [[x0, y0], [x1, y1]] = brushSelection;
    
    const cx = xScaleGlobal(commit.datetime);
    const cy = yScaleGlobal(commit.hourFrac);
    
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

function updateSelection() {
    d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
}

function brushed(event) {
    brushSelection = event.selection;
    updateSelection();
    updateSelectionCount();
    updateLanguageBreakdown();
}

function updateSelectionCount() {
    const selectedCommits = brushSelection
        ? commits.filter(isCommitSelected)
        : [];
  
    const countElement = document.getElementById('selection-count');
    countElement.textContent = `${
        selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
}

function updateLanguageBreakdown() {
    const selectedCommits = brushSelection
        ? commits.filter(isCommitSelected)
        : [];
    const container = document.getElementById('language-breakdown');
  
    if (selectedCommits.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);
  
    const breakdown = d3.rollup(
        lines,
        (v) => v.length,
        (d) => d.type
    );
  
    container.innerHTML = '';
  
    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1~%')(proportion);
  
        container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
    }
  
    return breakdown;
}

async function loadData() {
    try {
        data = await d3.csv('loc.csv', (row) => ({
            ...row,
            line: Number(row.line),
            depth: Number(row.depth),
            length: Number(row.length),
            date: new Date(row.date + 'T00:00' + row.timezone),
            datetime: new Date(row.datetime),
        }));
        
        console.log("Data loaded successfully");
        console.log("Number of rows:", data.length);
        
        displayStats();
        createScatterplot();
        initScrollytelling();
        
        // Optional: Display file breakdown
        initFilesScrollytelling();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
});

// At the end of main.js
export function updateTimeDisplay() {
    const timeSlider = document.getElementById('timeSlider');
    const selectedTime = document.getElementById('selectedTime');
    
    commitProgress = Number(timeSlider.value);
    
    // Ensure timeScale is defined before using it
    if (!timeScale) {
        console.error('Time scale not initialized');
        return;
    }
    
    const displayTime = timeScale.invert(commitProgress);
    selectedTime.textContent = displayTime.toLocaleString({
        dateStyle: "long", 
        timeStyle: "short"
    });
    
    filterCommitsByTime();
    updateScatterplot(filteredCommits);
    updateStats(filteredCommits);
}
window.updateTimeDisplay = function() {
    const timeSlider = document.getElementById('timeSlider');
    const selectedTime = document.getElementById('selectedTime');
    
    commitProgress = Number(timeSlider.value);
    
    // Ensure timeScale is defined before using it
    if (!timeScale) {
        console.error('Time scale not initialized');
        return;
    }
    
    const displayTime = timeScale.invert(commitProgress);
    selectedTime.textContent = displayTime.toLocaleString({
        dateStyle: "long", 
        timeStyle: "short"
    });
    
    filterCommitsByTime();
    updateScatterplot(filteredCommits);
    updateStats(filteredCommits);
};
function updateFileVisualization() {
    // Get lines from filtered commits
    let lines = filteredCommits.flatMap((d) => d.lines);
    
    // Create color scale for file types
    let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    
    // Group lines by file
    let files = d3
      .groups(lines, (d) => d.file)
      .map(([name, lines]) => {
        // Get unique types in this file
        const types = new Set(lines.map(line => line.type));
        
        return { 
          name, 
          lines,
          lineCount: lines.length,
          types: Array.from(types)
        };
      });
  
    // Sort files by number of lines in descending order
    files = d3.sort(files, (d) => -d.lines.length);
  
    // Clear existing file visualization
    const filesContainer = d3.select('.files');
    filesContainer.selectAll('div').remove();
  
    // Create file entries
    const fileEntries = filesContainer
      .selectAll('div')
      .data(files)
      .enter()
      .append('div');
  
    // Append file name and line count
    fileEntries
      .append('dt')
      .html(d => `
        <code>${d.name}</code>
        <small>${d.lineCount} lines (${d.types.join(', ')})</small>
      `);
  
    // Append line visualization
    fileEntries
      .append('dd')
      .selectAll('div')
      .data(d => d.lines)
      .enter()
      .append('div')
      .attr('class', 'line')
      .style('background', d => fileTypeColors(d.type));
  }

  function initScrollytelling() {
    // Set up scrollytelling variables
    NUM_ITEMS = commits.length;
    totalHeight = (NUM_ITEMS - 1) * ITEM_HEIGHT;
    
    scrollContainer = d3.select('#commits-scroll-container');
    spacer = d3.select('#commits-spacer');
    itemsContainer = d3.select('#commits-items-container');

    // Set spacer height
    spacer.style('height', `${totalHeight}px`);

    // Add scroll event listener
    scrollContainer.on('scroll', () => {
        const scrollTop = scrollContainer.property('scrollTop');
        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
        renderItems(startIndex);
    });

    // Initial render
    renderItems(0);
}

function renderItems(startIndex) {
    // Clear previous items
    itemsContainer.selectAll('div').remove();
    
    // Slice commits
    const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
    const newCommitSlice = commits.slice(startIndex, endIndex);
    
    // Update scatterplot with visible commits
    updateScatterplot(newCommitSlice);
    
    // Render commit items
    itemsContainer.selectAll('div')
        .data(newCommitSlice)
        .enter()
        .append('div')
        .attr('class', 'scrolly-item')
        .html((commit, index) => `
            <p>
                On ${commit.datetime.toLocaleString("en", {dateStyle: "full", timeStyle: "short"})}, I made 
                <a href="${commit.url}" target="_blank">
                    ${index > 0 ? 'another commit' : 'my first commit, and it was glorious'}
                </a>. 
                I edited ${commit.totalLines} lines across 
                ${d3.rollups(commit.lines, v => v.length, d => d.file).length} files. 
                Then I looked over all I had made, and I saw that it was very good.
            </p>
        `)
        .style('position', 'absolute')
        .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`);
}

function renderFilesItems(files, startIndex) {
    // Clear previous items
    filesItemsContainer.selectAll('div').remove();
    
    // Slice files
    const endIndex = Math.min(startIndex + FILES_VISIBLE_COUNT, files.length);
    const newFileSlice = files.slice(startIndex, endIndex);
    
    // Render files visualization for this slice
    renderFilesVisualization(newFileSlice);
    
    // Render file items
    filesItemsContainer.selectAll('div')
        .data(newFileSlice)
        .enter()
        .append('div')
        .attr('class', 'scrolly-item')
        .html((file, index) => `
            <p>
                The ${file.name} file is a significant part of the project, 
                containing ${file.totalLines} lines of code across 
                ${file.types.length} technology types. 
                Its complexity reveals the depth of our project's architecture.
            </p>
        `)
        .style('position', 'absolute')
        .style('top', (_, idx) => `${idx * FILES_ITEM_HEIGHT}px`);
}

function displayCommitFiles() {
    const lines = filteredCommits.flatMap((d) => d.lines);
    let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    let files = d3.groups(lines, (d) => d.file).map(([name, lines]) => {
        return { name, lines };
    });
    files = d3.sort(files, (d) => -d.lines.length);
    
    d3.select('.files').selectAll('div').remove();
    
    let filesContainer = d3.select('.files').selectAll('div')
        .data(files)
        .enter()
        .append('div');
    
    filesContainer.append('dt')
        .html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);
    
    filesContainer.append('dd')
        .selectAll('div')
        .data(d => d.lines)
        .enter()
        .append('div')
        .attr('class', 'line')
        .style('background', d => fileTypeColors(d.type));
}

function initFilesScrollytelling() {
    // Prepare files data
    const lines = commits.flatMap((d) => d.lines);
    const fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    let files = d3.groups(lines, (d) => d.file)
        .map(([name, lines]) => ({
            name, 
            lines,
            totalLines: lines.length,
            types: [...new Set(lines.map(l => l.type))]
        }))
        .sort((a, b) => b.totalLines - a.totalLines);

    FILES_NUM_ITEMS = files.length;
    const totalHeight = (FILES_NUM_ITEMS - 1) * FILES_ITEM_HEIGHT;

    // Select containers
    filesSpacer = d3.select('#files-spacer');
    filesScrollContainer = d3.select('#files-scroll-container');
    filesItemsContainer = d3.select('#files-items-container');

    // Set spacer height
    filesSpacer.style('height', `${totalHeight}px`);

    // Add scroll event listener
    filesScrollContainer.on('scroll', () => {
        const scrollTop = filesScrollContainer.property('scrollTop');
        let startIndex = Math.floor(scrollTop / FILES_ITEM_HEIGHT);
        startIndex = Math.max(0, Math.min(startIndex, files.length - FILES_VISIBLE_COUNT));
        renderFilesItems(files, startIndex);
    });

    // Initial render
    renderFilesItems(files, 0);
}

function renderFilesVisualization(files) {
    // Clear previous visualization
    const visContainer = d3.select('#files-visualization');
    visContainer.selectAll('*').remove();

    // Create visualization similar to displayCommitFiles
    const fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    
    const filesSection = visContainer.append('dl').attr('class', 'files');
    
    const fileEntries = filesSection
        .selectAll('div')
        .data(files)
        .enter()
        .append('div');

    // File name and line count
    fileEntries
        .append('dt')
        .html(d => `
            <code>${d.name}</code>
            <small>${d.totalLines} lines (${d.types.join(', ')})</small>
        `);

    // Line visualization
    fileEntries
        .append('dd')
        .selectAll('div')
        .data(d => d.lines)
        .enter()
        .append('div')
        .attr('class', 'line')
        .style('background', d => fileTypeColors(d.type));
}