flickering = true;
count = 2000;
loadParticles()

async function loadParticles() {
    await tsParticles.load({
        id: "tsparticles",
        options: {
            preset: "stars",

            background: {
                color: "transparent",
                image: "url('milkyway.jpg')",
                size: "cover",
            },
            fpsLimit: 60,
            particles: {
                color: {
                    value: [
                        '#ffa280', '#ffa880', '#ffae80', '#ffb480', '#ffba80', '#ffc080',
                        '#ffc680', '#ffcc80', '#ffd280', '#ffd880', '#ffde80', '#ffe480',
                        '#ffec80', '#f4e58b', '#e9de96', '#ded7a1', '#d3d0ac', '#c8c9b7',
                        '#bfbfbf', '#b9c2c5', '#b3c5cb', '#adc8d1', '#a7cbd7', '#a1cedd',
                        '#9dd0e1', '#98c8e6', '#93c0eb', '#8eb8f0', '#89b0f5', '#84a8fa',
                        '#809fff'
                    ],
                },
                move: {
                    enable: false
                },
                number: {
                    density: {
                        enable: true,
                    },
                    value: count
                },
                opacity: {
                    value: {
                        min: 0.5,
                        max: 0.8
                    },
                    animation: {
                        count: 0,
                        enable: flickering,
                        speed: 5,
                        decay: 0,
                        delay: 0,
                        sync: false,
                        mode: "auto",
                        startValue: "random",
                        destroy: "none"
                    }
                },
                size: {
                    value: {
                        min: 0.2,
                        max: 1.2
                    }
                }
            }
        }
    });
}

// lively fns
function livelyPropertyListener(name, val) {
    switch (name) {
        case "count":
            count = Number(val);
            break;
        case "flickering":
            flickering = Boolean(val);
            break;
    }
    loadParticles()
}