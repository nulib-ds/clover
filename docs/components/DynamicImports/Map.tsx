import dynamic from "next/dynamic";

const Map = dynamic(() => import("@samvera/clover-iiif/map"), {
  ssr: false,
});

const CloverMap = (props) => {
  return <Map {...props} />;
};

export default CloverMap;
