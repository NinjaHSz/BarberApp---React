import React from "react";

const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[50px] relative">
      <style>{`
        .spinner-container {
          position: relative;
          width: 9px;
          height: 9px;
        }

        .spinner-bar {
          position: absolute;
          width: 50%;
          height: 150%;
          background: #FAFAFA;
          transform: rotate(calc(var(--rotation) * 1deg)) translate(0, calc(var(--translation) * 1%));
          animation: spinner-fzua35 1s calc(var(--delay) * 1s) infinite ease;
        }

        @keyframes spinner-fzua35 {
          0%, 10%, 20%, 30%, 50%, 60%, 70%, 80%, 90%, 100% {
            transform: rotate(calc(var(--rotation) * 1deg)) translate(0, calc(var(--translation) * 1%));
          }

          50% {
            transform: rotate(calc(var(--rotation) * 1deg)) translate(0, calc(var(--translation) * 1.5%));
          }
        }
      `}</style>
      <div className="spinner-container">
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.1",
              "--rotation": "36",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.2",
              "--rotation": "72",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.3",
              "--rotation": "108",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.4",
              "--rotation": "144",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.5",
              "--rotation": "180",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.6",
              "--rotation": "216",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.7",
              "--rotation": "252",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.8",
              "--rotation": "288",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "0.9",
              "--rotation": "324",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
        <div
          className="spinner-bar"
          style={
            {
              "--delay": "1",
              "--rotation": "360",
              "--translation": "150",
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
};

export default Loader;
