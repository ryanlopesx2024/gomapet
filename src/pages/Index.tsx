import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.display = "none";

    return () => {
      if (root) root.style.display = "block";
    };
  }, []);

  return null;
};

export default Index;
