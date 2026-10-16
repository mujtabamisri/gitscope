# GitScope - GitHub Developer Intelligence

GitScope is a developer analytics dashboard that turns public GitHub profile and repository data into an easy-to-understand overview of a developer's activity, technologies, and repository health.

## Features

- **Developer profiles:** View public GitHub profile information and statistics.
- **Language analytics:** Explore programming language usage with interactive charts.
- **Recent activity:** Review public GitHub events and activity patterns.
- **Activity heatmap:** Visualize recent developer activity.
- **Repository explorer:** Search, filter, sort, and paginate through repositories.
- **Repository health scoring:** Assess repository signals such as recent updates, descriptions, and licenses.
- **CSV export:** Export repository data for further analysis.
- **Profile comparison:** Compare two GitHub developers across key statistics and programming languages.
- **Caching and error handling:** Reduce repeated API requests and provide helpful messages for common errors.
- **Responsive interface:** Use the dashboard on desktop, tablet, and mobile screens.

## Built With

- HTML
- CSS
- JavaScript
- Vite
- Chart.js
- GitHub REST API
- Vitest

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- npm, included with Node.js

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/mujtabamisri/gitscope.git
   ```

2. Enter the project directory:

   ```bash
   cd github-activity-analyzer
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL displayed in your terminal.

## Testing

Run the automated test suite:

```bash
npm test
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Data and Privacy

GitScope retrieves publicly available GitHub data through the GitHub REST API. API rate limits may affect how frequently data can be retrieved.

## Project Purpose

This project was built to explore JavaScript, API integration, data visualization, automated testing, caching, and frontend application development.

## License

GitScope is distributed under a custom proprietary license.

You may view, download, and run the project for personal, non-commercial use, subject to the restrictions in the [LICENSE] file. Modification, redistribution, and commercial use are not permitted without prior written permission.
