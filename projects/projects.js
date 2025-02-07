import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";


let projects = [];
let query = '';
let selectedIndex = -1;

const customColors = [
    'oklch(70% 0.2 30)', 
    'oklch(70% 0.2 130)', 
    'oklch(70% 0.2 230)', 
    'oklch(70% 0.2 330)'  
];
const colorScale = d3.scaleOrdinal(customColors);

function getColorForYear(year) {
    return colorScale(year);
}

function renderPieChart(projectsToShow) {

    let rolledData = d3.rollups(
        projectsToShow,
        (v) => v.length,
        (d) => d.year
    );

    let data = rolledData.map(([year, count]) => ({
        value: count,
        label: year
    }));


    data.sort((a, b) => a.label.localeCompare(b.label));


    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let sliceGenerator = d3.pie().value(d => d.value);
    let arcData = sliceGenerator(data);


    let svg = d3.select('svg');
    svg.selectAll('path').remove();
    let legend = d3.select('.legend');
    legend.selectAll('*').remove();


    arcData.forEach((d, i) => {
        svg.append('path')
           .attr('d', arcGenerator(d))
           .attr('fill', getColorForYear(d.data.label))
           .attr('class', i === selectedIndex ? 'selected' : '')
           .on('click', () => {
               selectedIndex = selectedIndex === i ? -1 : i;
               

               svg.selectAll('path')
                  .attr('class', (_, idx) => idx === selectedIndex ? 'selected' : '');
               
               legend.selectAll('li')
                    .attr('class', (_, idx) => idx === selectedIndex ? 'selected legend-item' : 'legend-item');


               if (selectedIndex === -1) {
                   renderProjects(filterProjects(query), projectsContainer, 'h2');
               } else {
                   const selectedYear = data[selectedIndex].label;
                   const filteredProjects = filterProjects(query).filter(p => p.year === selectedYear);
                   renderProjects(filteredProjects, projectsContainer, 'h2');
               }
           });
    });

    data.forEach((d, idx) => {
        legend.append('li')
              .attr('style', `--color:${getColorForYear(d.label)}`)
              .attr('class', idx === selectedIndex ? 'selected legend-item' : 'legend-item')
              .html(`<span class="swatch"></span>${d.label} <em>(${d.value})</em>`)
              .on('click', () => {
                  svg.selectAll('path').nodes()[idx].dispatchEvent(new Event('click'));
              });
    });
}

function filterProjects(query) {
    return projects.filter(project => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });
}

async function initialize() {

    projects = await fetchJSON('../lib/projects.json');
    const projectsContainer = document.querySelector('.projects');

    renderProjects(projects, projectsContainer, 'h2');
    renderPieChart(projects);

    const searchInput = document.querySelector('.searchBar');
    searchInput.addEventListener('input', (event) => {
        query = event.target.value;
        const filteredProjects = filterProjects(query);
        renderProjects(filteredProjects, projectsContainer, 'h2');
        renderPieChart(filteredProjects);
    });
}

initialize();