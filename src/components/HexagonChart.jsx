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

export default function HexagonChart({ scoreData, fullMarkData }) {
  // The order must be consistent
  const groupLabels = ["Japanese I", "Japanese II", "Japanese III", "Japanese IV", "Japanese V", "Japanese VI"];
  const baselineRing = 8;
  const labels = groupLabels.map((group) => {
    const gained = scoreData?.[group] || 0;
    const full = fullMarkData?.[group] || 0;
    return [group, `${gained}/${full}`];
  });
  const progressRatios = groupLabels.map((group) => {
    const gained = scoreData?.[group] || 0;
    const full = fullMarkData?.[group] || 0;
    if (!full) {
      return 0;
    }
    return (gained / full) * 100;
  });
  const chartValues = progressRatios.map((ratio) => {
    // Keep a small base shape even when ratio is zero.
    return baselineRing + ((100 - baselineRing) * ratio) / 100;
  });
  
  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Overall Progress',
        data: chartValues,
        backgroundColor: 'rgba(45, 90, 163, 0.20)',
        borderColor: 'rgba(45, 90, 163, 1)',
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 100,
        ticks: {
          display: false,
          stepSize: 20,
        },
        pointLabels: {
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return <Radar data={data} options={options} />;
}