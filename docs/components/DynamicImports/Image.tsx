import dynamic from "next/dynamic";

const Image = dynamic(() => import("@samvera/clover-iiif/image"), {
  ssr: false,
});

const CloverImage = (props) => {
  return <Image {...props} />;
};

export default CloverImage;
