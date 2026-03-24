import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function HexagonChart({ scoreData }) {
  // The order must be consistent
  const labels = ["Japanese I", "Japanese II", "Japanese III", "Japanese IV", "Japanese V", "Japanese VI"];
  
  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Total Score per Group',
        data: labels.map(label => scoreData[label] || 0), // Use the data for each label
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
           stepSize: 10, // Adjust this based on expected scores
        }
      }
    }
  }

  return <Radar data={data} options={options} />;
}